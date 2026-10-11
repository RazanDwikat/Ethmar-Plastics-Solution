import {validateSavedData} from './saved-data-validation';
import {normalizeRequirements,setupProblems,type Profile} from './setup';
import {bindFormula} from './custom-formula';
export function importSetupJson(text:string):Profile{
 if(text.length>1024*1024)throw new Error('This setup is too large. Choose a setup JSON file under 1 MB.');
 let profile:Profile;
 try{profile=JSON.parse(text);validateSavedData(null,[profile]);}catch{throw new Error('This is not a readable Ethmar setup JSON file. Nothing was changed.');}
 const errors=setupProblems(profile.setup,profile.headers).errors;
 if(errors.length)throw new Error(`This setup needs correction: ${errors.join(' ')}`);
 profile.setup=normalizeRequirements(profile.setup);
  profile.setup.measurements=profile.setup.measurements.map(m=>{
   if(m.template!=='Custom formula')return m;
   return {...m,formulaBindings:bindFormula(m.formula??'',profile.setup,m)};
  });
 return profile;
}
