import type { Definition, Settings } from './import-types';

// Domain-specific names live only in editable defaults and sample configuration.
export function defaultSettings(): Settings {
  const definitions: Definition[] = [
    ['input','Material input','MATERIAL_IN','quantity'],
    ['output','Good output','GOOD_OUT','quantity'],
    ['waste','Scrap','SCRAP','quantity'],
    ['setup','Changeover','CHANGEOVER','timed'],
    ['stop','Unplanned downtime','DOWNTIME_UNPLANNED','timed'],
  ].map(([id,label,value,kind])=>({id,label,values:[value],kind:kind as Definition['kind'],column:'',timeMode:'range',start:'',end:'',duration:'',durationUnit:'hours'}));
  return {
    shape:'event',mapping:{},definitions,customFields:[],quantityUnit:'kg',dateFormat:'ISO',decimalSeparator:'.',
    synonyms:{
      run:['run','run_id','run id','batch','batch_id','رقم التشغيل'],
      order:['order','order_id','order id','رقم الطلب'],
      event:['event','event_id','event id'],
      eventType:['event_type','event type','activity','نوع الحدث'],
      quantity:['quantity','quantity_kg','amount','weight','الكمية'],
      start:['start','start_time','start time'],end:['end','end_time','end time'],
      duration:['duration','duration_hours','duration_minutes','elapsed'],
      date:['date','run_date','production_date','التاريخ'],
      line:['line','production_line'],machine:['machine','oven','equipment'],
      tool:['mold','mould','tool'],shift:['shift'],product:['product','product_id'],
      reason:['reason','downtime_reason','السبب'],
    },
  };
}
