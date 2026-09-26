import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const moduleCache = new Map();
const mocks = {
  "@supabase/supabase-js": `export function createClient(url,key,options){return globalThis.__yachtWorkspaceTest.client(key,options)}`,
  "./activeBearerServer": `export async function authenticateActiveBearer(){return globalThis.__yachtWorkspaceTest.auth}`,
  "next/server": `export const NextResponse={json:(data,init)=>Response.json(data,init)}`,
  "./requestRateLimitServer": `export function consumeRequestRateLimit(){return {allowed:true}}`,
};
const asModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

async function loadModule(path, mock = false) {
  const cacheKey = `${path}:${mock}`;
  if (moduleCache.has(cacheKey)) return moduleCache.get(cacheKey);
  let source = await readFile(new URL(path, root), "utf8");
  source = source.replace(/import "server-only";/g, "");
  const imports = [...source.matchAll(/from "([^"]+)"/g)];
  for (const [,specifier] of imports) {
    let target;
    if (mock && mocks[specifier]) target = asModule(mocks[specifier]);
    else if (specifier.startsWith(".")) {
      const relativeModule = /\.(?:m?js|ts)$/.test(specifier) ? specifier : `${specifier}.ts`;
      const filePath = new URL(relativeModule, new URL(path, root)).pathname;
      const relativePath = filePath.slice(root.pathname.length);
      target = await loadModule(relativePath, mock);
    } else target = import.meta.resolve(specifier);
    source = source.replaceAll(`from "${specifier}"`, `from "${target}"`);
  }
  const result = asModule(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  moduleCache.set(cacheKey, result);
  return result;
}

const shared = await import(await loadModule("app/lib/yachtWorkspace.ts"));
const requests = await import(await loadModule("app/lib/yachtWorkspaceRequest.ts"));
const server = await import(await loadModule("app/lib/yachtWorkspaceServer.ts", true));
const userId = "11111111-1111-4111-8111-111111111111";
const yachtId = "22222222-2222-4222-8222-222222222222";
const photoId = "33333333-3333-4333-8333-333333333333";
const validDetails = { name: "Aurora", yachtType: "motor_yacht", model: "Sirena 88", crewSize: "8", flag: "GB" };
const validPhoto = new File([await sharp({create:{width:32,height:24,channels:3,background:{r:10,g:90,b:160}}}).jpeg().toBuffer()], "boat.jpg", {type:"image/jpeg"});

function formRequest(fields = validDetails, photo = null) {
  const body = new FormData();
  for (const [key,value] of Object.entries(fields)) body.set(key,value);
  if (photo) body.set("photo", photo);
  return new Request("https://example.test/api/yachts", { method:"POST", body, headers:{Authorization:"Bearer test"} });
}

test("metadata shares job yacht types and countries, preserves unchanged legacy flags", () => {
  assert.deepEqual(shared.parseYachtWorkspaceDetails({...validDetails,name:" Aurora ",flag:"gb"}).value,
    {...validDetails,crewSize:8});
  for (const [field,value] of [["yachtType","submarine"],["flag","Not a country"],["crewSize","1.5"],["crewSize","-1"],["crewSize","1000"],["crewSize","8e1"],["crewSize",""],["name"," "],["model","x".repeat(121)]]) {
    assert.equal(shared.parseYachtWorkspaceDetails({...validDetails,[field]:value}).ok,false,field);
  }
  assert.equal(shared.parseYachtWorkspaceDetails({...validDetails,crewSize:"0"}).ok,true);
  assert.equal(shared.parseYachtWorkspaceDetails({...validDetails,flag:"British"},"British").ok,true);
  assert.equal(shared.parseYachtWorkspaceDetails({...validDetails,flag:"Another"},"British").ok,false);
  assert.equal(shared.parseYachtWorkspaceDetails({...validDetails,flag:"British"}," British ").value.flag," British ");
  assert.equal(shared.parseYachtWorkspaceDetails({...validDetails,name:"x".repeat(120),model:"x".repeat(120)}).ok,true);
});

test("photo signing accepts only canonical paths bound to both owner and yacht", () => {
  const ownPath = `${userId}/${yachtId}/${photoId}.jpg`;
  assert.equal(shared.isYachtPhotoPath(ownPath,userId,yachtId),true);
  for (const path of [ownPath.replace(userId,photoId),ownPath.replace(yachtId,photoId),ownPath+"/../image.jpg","https://example.test/photo.jpg",null]) {
    assert.equal(shared.isYachtPhotoPath(path,userId,yachtId),false);
  }
});

test("multipart reader rejects duplicate, injected owner and nontext metadata fields", async () => {
  assert.equal((await requests.readYachtWorkspaceForm(formRequest())).get("crewSize"),"8");
  for (const decorate of [
    (form)=>form.append("name","Second yacht"),
    (form)=>form.set("owner_id",photoId),
    (form)=>form.set("name",validPhoto),
  ]) {
    const request = formRequest();
    const body = await request.formData();
    decorate(body);
    await assert.rejects(requests.readYachtWorkspaceForm(new Request(request.url,{method:"POST",body})),error=>error.code==="invalid_form");
  }
});

test("streamed multipart limit rejects chunked requests even with a dishonest Content-Length", async () => {
  const body = new ReadableStream({start(controller){
    controller.enqueue(new Uint8Array(requests.maximumYachtRequestBytes));
    controller.enqueue(new Uint8Array(1));controller.close();
  }});
  const request = new Request("https://example.test",{method:"POST",duplex:"half",body,headers:{"content-type":"multipart/form-data; boundary=x","content-length":"1"}});
  await assert.rejects(requests.readYachtWorkspaceForm(request),error=>error.status===413);
});

test("photo validation decodes images, normalizes to webp, rejects forged signatures and enforces 4MB", async () => {
  const photo = await server.readYachtPhoto(validPhoto);
  assert.equal(photo.extension,"webp");
  assert.equal((await sharp(photo.bytes).metadata()).format,"webp");
  const forged = new File([Uint8Array.from([0xff,0xd8,0xff,...Array(40).fill(0)])],"fake.jpg",{type:"image/jpeg"});
  await assert.rejects(server.readYachtPhoto(forged),error=>error.code==="invalid_photo_data");
  await assert.rejects(server.readYachtPhoto(new File(["<svg>unsafe</svg>"],"fake.jpg",{type:"image/jpeg"})),error=>error.code==="invalid_photo_data");
  await assert.rejects(server.readYachtPhoto(new File([new Uint8Array(shared.maximumYachtPhotoBytes+1)],"large.jpg",{type:"image/jpeg"})),error=>error.status===413);
  await assert.rejects(server.readYachtPhoto(new File(["<svg/>"],"boat.svg",{type:"image/svg+xml"})),error=>error.status===415);
});

function mockClients({ existing = null, writeError = null, authFailure = false, listing = [] } = {}) {
  process.env.NEXT_PUBLIC_SUPABASE_URL="https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY="service";
  const calls = [];
  const storage = {
    async upload(path) { calls.push(["upload",path]); return {error:null}; },
    async remove(paths) { calls.push(["remove",...paths]);return {error:null}; },
    async createSignedUrls(paths) { calls.push(["sign",...paths]);return {data:paths.map(path=>({path,signedUrl:"https://signed.example/photo"}))}; },
  };
  const client = {
    storage:{from:()=>storage},
    from(table) {
      calls.push(["table",table]);
      let writing=false;
      let row = existing;
      const query = {
        select(){return query},eq(key,value){calls.push(["filter",key,value]);return query},
        order(){return query},async limit(){return {data:listing,error:null}},
        is(key,value){calls.push(["filter",key,value]);return query},
        insert(fields){writing=true;row=fields;calls.push(["insert",fields]);return query},
        update(fields){writing=true;row={...existing,...fields};calls.push(["update",fields]);return query},
        async maybeSingle(){return writing ? {data:writeError?null:row,error:writeError} : {data:existing,error:null}},
        async single(){return {data:writeError?null:row,error:writeError}},
      };
      return query;
    },
  };
  globalThis.__yachtWorkspaceTest = {
    client:()=>client,
    auth:authFailure?{ok:false,error:"Invalid session",status:401,reason:"invalid_session"}:{ok:true,user:{id:userId}},
  };
  return calls;
}

test("GET requires bearer, filters by owner and emits private cache headers without signing unbound photos", async () => {
  let calls=mockClients();
  const noBearer=await server.getYachtWorkspace(new Request("https://example.test/api/yachts"));
  assert.equal(noBearer.status,401);
  assert.equal(calls.length,0);
  const ownPath=`${userId}/${yachtId}/${photoId}.jpg`;
  const row={id:yachtId,owner_id:userId,name:"Aurora",model:"Sirena 88",flag:"GB",yacht_type:"motor_yacht",crew_size:8,photo_path:ownPath};
  calls=mockClients({listing:[row,{...row,id:photoId,photo_path:ownPath}]});
  const response=await server.getYachtWorkspace(new Request("https://example.test/api/yachts",{headers:{Authorization:"Bearer test"}}));
  assert.equal(response.status,200);
  assert.match(response.headers.get("cache-control"),/private, no-store/);
  assert.match(response.headers.get("vary"),/Authorization/);
  assert.equal(response.headers.get("x-content-type-options"),"nosniff");
  assert.ok(calls.some(call=>call[0]==="filter"&&call[1]==="owner_id"&&call[2]===userId));
  assert.deepEqual(calls.find(call=>call[0]==="sign"),["sign",ownPath]);
  const result=await response.json();
  assert.equal(result.yachts[0].photoUrl,"https://signed.example/photo");
  assert.equal(result.yachts[1].photoUrl,null);
});

test("save fails closed for invalid sessions and inaccessible yachts before upload", async () => {
  let calls = mockClients({authFailure:true});
  assert.equal((await server.saveYachtWorkspace(formRequest())).status,401);
  assert.equal(calls.length,0);
  calls=mockClients();
  assert.equal((await server.saveYachtWorkspace(formRequest(validDetails,validPhoto),yachtId)).status,404);
  assert.ok(calls.some(call=>call[0]==="filter"&&call[1]==="owner_id"&&call[2]===userId));
  assert.equal(calls.some(call=>call[0]==="upload"),false);
});

test("failed database create cleans uploaded photo and respects the durable yacht quota", async () => {
  const calls=mockClients({writeError:{code:"54000"}});
  const response=await server.saveYachtWorkspace(formRequest(validDetails,validPhoto));
  assert.equal(response.status,409);
  assert.equal((await response.json()).code,"yacht_limit");
  const upload=calls.find(call=>call[0]==="upload");
  assert.ok(upload);
  assert.deepEqual(calls.find(call=>call[0]==="remove"),["remove",upload[1]]);
  assert.equal(calls.find(call=>call[0]==="insert")[1].owner_id,userId);
});

test("failed edit retains existing photo; successful replacement removes only old bound photo", async () => {
  const oldPath=`${userId}/${yachtId}/${photoId}.jpg`;
  const existing={id:yachtId,owner_id:userId,name:"Old yacht",model:null,flag:"GB",yacht_type:null,crew_size:null,photo_path:oldPath};
  let calls=mockClients({existing,writeError:{code:"fail"}});
  assert.equal((await server.saveYachtWorkspace(formRequest(validDetails,validPhoto),yachtId)).status,503);
  assert.equal(calls.some(call=>call[0]==="remove"&&call[1]===oldPath),false);
  calls=mockClients({existing});
  const response=await server.saveYachtWorkspace(formRequest(validDetails,validPhoto),yachtId);
  assert.equal(response.status,200);
  assert.equal((await response.json()).yacht.crewSize,8);
  assert.deepEqual(calls.find(call=>call[0]==="remove"),["remove",oldPath]);
  assert.equal("owner_id" in calls.find(call=>call[0]==="update")[1],false);
  assert.equal("mmsi" in calls.find(call=>call[0]==="update")[1],false);
});
