(function(){
  const cfg=window.ZERO_SUPABASE_CONFIG||{};
  if(!window.supabase||!cfg.url||!cfg.anonKey){window.ZERO_CLOUD_READY=Promise.resolve();return;}
  const db=window.ZERO_AUTH||window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true}});
  window.ZERO_AUTH=db;
  const prefix="zero.v1.", financeKey="laporan-keuangan-v1", ownerKey="zero.local.owner";
  const modules=["watchlist","trades","holdings"];
  let userId=null, syncing=false, switching=false, flushing=false;
  const pending=new Map();
  function indicator(message,error){document.querySelectorAll(".zero-cloud-status").forEach(e=>{e.textContent=message;e.dataset.state=error?"error":"ok";});}
  function parse(key,fallback){try{const raw=localStorage.getItem(key);return raw===null?fallback:JSON.parse(raw);}catch(e){return fallback;}}
  function writeLocal(key,value){localStorage.setItem(key,JSON.stringify(value));}
  function scopedKey(uid,key){return "zero.user."+uid+"."+key;}
  function snapshotUser(uid){
    if(!uid)return;
    [...modules.map(m=>prefix+m),financeKey].forEach(key=>{
      const value=localStorage.getItem(key);
      if(value!==null)localStorage.setItem(scopedKey(uid,key),value);
    });
  }
  async function fetchModule(uid,module){
    const {data,error}=await db.from("zero_user_data").select("payload").eq("user_id",uid).eq("module",module).maybeSingle();
    if(error)throw error;
    return data?data.payload:null;
  }
  async function flushPending(){
    if(!userId||flushing||switching||!pending.size)return;
    flushing=true;const target=userId;
    indicator("Menyimpan ke cloud…");
    try{
      for(const [module,payload] of [...pending.entries()]){
        if(userId!==target)break;
        const {error}=await db.from("zero_user_data").upsert({user_id:target,module,payload,updated_at:new Date().toISOString()},{onConflict:"user_id,module"});
        if(error){indicator("Tersimpan di perangkat · cloud menunggu koneksi",true);console.error("ZERO cloud sync:",error.message);return;}
        if(userId===target)pending.delete(module);
      }
      if(userId===target)indicator("Cloud tersinkron");
    }finally{flushing=false;}
  }
  async function write(module,payload){
    if(!modules.includes(module)&&module!=="finance")return false;
    if(!userId||switching)return false;
    pending.set(module,payload);
    await flushPending();
    return !pending.has(module);
  }
  async function activateUser(nextId){
    if(!nextId)return;
    if(switching)return;
    if(userId===nextId)return;
    switching=true;indicator("Menyiapkan data akun…");
    const previous=localStorage.getItem(ownerKey);
    try{
      if(previous&&previous!==nextId)snapshotUser(previous);
      if(!previous){
        // First authenticated session: adopt the existing legacy local data once.
        localStorage.setItem(ownerKey,nextId);
        userId=nextId;
        syncing=true;
        for(const module of modules){
          const local=parse(prefix+module,[]);
          const remote=await fetchModule(nextId,module);
          if(remote===null){if(Array.isArray(local)&&local.length)pending.set(module,local);}
          else{
            const merged=[...new Map([...(Array.isArray(remote)?remote:[]),...(Array.isArray(local)?local:[])].map(item=>[JSON.stringify(item),item])).values()];
            writeLocal(prefix+module,merged);
            if(merged.length!==(Array.isArray(remote)?remote.length:0))pending.set(module,merged);
          }
        }
        const localFinance=parse(financeKey,null);
        const remoteFinance=await fetchModule(nextId,"finance");
        if(remoteFinance!==null)writeLocal(financeKey,{sample:false,tx:remoteFinance});
        else if(localFinance&&!localFinance.sample&&Array.isArray(localFinance.tx))pending.set("finance",localFinance.tx);
        syncing=false;
      }else{
        if(userId)snapshotUser(userId);
        pending.clear();
        userId=nextId;
        syncing=true;
        for(const module of modules){
          const localRaw=localStorage.getItem(scopedKey(nextId,prefix+module));
          const remote=await fetchModule(nextId,module);
          const local=localRaw===null?(previous===nextId?parse(prefix+module,[]):null):parse(scopedKey(nextId,prefix+module),[]);
          let value;
          if(local!==null&&remote!==null)value=[...new Map([...(Array.isArray(remote)?remote:[]),...(Array.isArray(local)?local:[])].map(item=>[JSON.stringify(item),item])).values()];
          else if(local!==null)value=local;
          else value=Array.isArray(remote)?remote:[];
          writeLocal(prefix+module,value);
          if(remote===null&&Array.isArray(value)&&value.length)pending.set(module,value);
          else if(local!==null&&Array.isArray(value)&&(Array.isArray(remote)?remote.length:0)!==value.length)pending.set(module,value);
        }
        const localFinanceRaw=localStorage.getItem(scopedKey(nextId,financeKey));
        const remoteFinance=await fetchModule(nextId,"finance");
        const localFinance=localFinanceRaw===null?(previous===nextId?parse(financeKey,null):null):parse(scopedKey(nextId,financeKey),null);
        let tx=Array.isArray(remoteFinance)?remoteFinance:[];
        if(localFinance&&!localFinance.sample&&Array.isArray(localFinance.tx)){
          tx=[...new Map([...tx,...localFinance.tx].map(item=>[JSON.stringify(item),item])).values()];
        }
        writeLocal(financeKey,{sample:false,tx});
        if(remoteFinance===null&&tx.length)pending.set("finance",tx);
        else if(localFinance&&tx.length!==(Array.isArray(remoteFinance)?remoteFinance.length:0))pending.set("finance",tx);
        localStorage.setItem(ownerKey,nextId);
        syncing=false;
      }
      localStorage.setItem(ownerKey,nextId);
      indicator("Cloud tersinkron");
    }catch(error){
      syncing=false;indicator("Cloud sync gagal",true);console.error("ZERO cloud init:",error.message);
      throw error;
    }finally{switching=false;}
    await flushPending();
  }
  window.addEventListener("online",flushPending);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")flushPending();});
  window.ZERO_CLOUD={
    async push(module,payload){return write(module,payload);},
    async flush(){return flushPending();},
    async pushFinance(value){if(value&&!value.sample&&Array.isArray(value.tx))return write("finance",value.tx);},
    async pullFinance(){if(!userId)return null;return fetchModule(userId,"finance");}
  };
  window.ZERO_CLOUD_READY=db.auth.getSession().then(async({data,error})=>{
    if(error)throw error;
    if(!data.session){indicator("Cloud belum tersambung",true);return;}
    await activateUser(data.session.user.id);
  }).catch(error=>{indicator("Cloud sync gagal",true);console.error("ZERO cloud init:",error.message);});
  const originalSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
    originalSet.call(this,key,value);
    if(this!==localStorage||syncing||switching||!userId||localStorage.getItem(ownerKey)!==userId)return;
    if(key.indexOf(prefix)===0){const module=key.slice(prefix.length);if(modules.includes(module)){try{write(module,JSON.parse(value));}catch(e){}}}
    if(key===financeKey){try{const parsed=JSON.parse(value);if(!parsed.sample&&Array.isArray(parsed.tx))write("finance",parsed.tx);}catch(e){}}
  };
  window.ZERO=window.ZERO||{};window.ZERO.ready=window.ZERO_CLOUD_READY;
  db.auth.onAuthStateChange((event,session)=>{
    if(event==="SIGNED_IN"&&session)activateUser(session.user.id).catch(()=>{});
    if(event==="SIGNED_OUT"){if(userId)snapshotUser(userId);userId=null;pending.clear();indicator("Cloud belum tersambung",true);}
  });
})();