(function(){
  const cfg=window.ZERO_SUPABASE_CONFIG||{};
  if(!window.supabase||!cfg.url||!cfg.anonKey){window.ZERO_CLOUD_READY=Promise.resolve();return;}
  const db=window.ZERO_AUTH||window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true}});
  window.ZERO_AUTH=db;
  const prefix="zero.v1.", financeKey="laporan-keuangan-v1";
  const modules=["watchlist","trades","holdings"];
  let userId=null, syncing=false;
  function indicator(message,error){document.querySelectorAll(".zero-cloud-status").forEach(e=>{e.textContent=message;e.dataset.state=error?"error":"ok";});}
  async function write(module,payload){
    if(!userId)return;
    const {error}=await db.from("zero_user_data").upsert({user_id:userId,module,payload,updated_at:new Date().toISOString()},{onConflict:"user_id,module"});
    if(error){indicator("Cloud sync gagal",true);console.error("ZERO cloud sync:",error.message);return;}
    indicator("Cloud tersinkron");
  }
  async function syncModule(module,key,read,writeLocal,skipSample){
    const {data,error}=await db.from("zero_user_data").select("payload").eq("user_id",userId).eq("module",module).maybeSingle();
    if(error)throw error;
    if(data){writeLocal(data.payload);return;}
    const local=read();
    if(skipSample&&skipSample(local))return;
    if(Array.isArray(local)&&local.length)await write(module,local);
  }
  window.ZERO_CLOUD={
    async push(module,payload){return write(module,payload);},
    async pushFinance(value){if(value&&!value.sample&&Array.isArray(value.tx))return write("finance",value.tx);},
    async pullFinance(){if(!userId)return null;const {data,error}=await db.from("zero_user_data").select("payload").eq("user_id",userId).eq("module","finance").maybeSingle();if(error)throw error;return data?data.payload:null;}
  };
  window.ZERO_CLOUD_READY= db.auth.getSession().then(async ({data,error})=>{
    if(error)throw error;
    if(!data.session){indicator("Cloud belum tersambung",true);return;}
    userId=data.session.user.id;
    syncing=true;
    try{
      for(const module of modules){
        const key=prefix+module;
        await syncModule(module,key,()=>{try{return JSON.parse(localStorage.getItem(key)||"[]")}catch(e){return[]}},v=>localStorage.setItem(key,JSON.stringify(v)));
      }
      await syncModule("finance",financeKey,()=>{try{return JSON.parse(localStorage.getItem(financeKey)||"null")}catch(e){return null}},v=>localStorage.setItem(financeKey,JSON.stringify({sample:false,tx:v})),v=>!v||v.sample===true);
      indicator("Cloud tersinkron");
    }finally{syncing=false;}
  }).catch(e=>{indicator("Cloud sync gagal",true);console.error("ZERO cloud init:",e.message);});
  const originalSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
    originalSet.call(this,key,value);
    if(this!==localStorage||syncing||!userId)return;
    if(key.indexOf(prefix)===0){const module=key.slice(prefix.length);if(modules.includes(module)){try{write(module,JSON.parse(value))}catch(e){}}}
    if(key===financeKey){try{const parsed=JSON.parse(value);if(!parsed.sample&&Array.isArray(parsed.tx))write("finance",parsed.tx)}catch(e){}}
  };
  db.auth.onAuthStateChange((event,session)=>{
    if(event==="SIGNED_IN"&&session&&session.user.id!==userId){location.reload();}
    if(event==="SIGNED_OUT"){userId=null;indicator("Cloud belum tersambung",true);}
  });
})();