import {NextResponse} from "next/server"
import {supabase} from "@/lib/supabase"

export async function POST(){

try{

const {data}=await supabase
.from("automation_queue")
.select(`
*,
email_contacts(*)
`)
.eq(
"channel",
"EMAIL"
)
.eq(
"status",
"pending"
)
.limit(5)

for(const item of data || []){

console.log(
"Enviar:",
item.email_contacts.email
)

await supabase
.from("automation_queue")
.update({

status:"completed",

sent_at:new Date()

})
.eq(
"id",
item.id
)

}

return NextResponse.json({
success:true
})

}catch(e:any){

return NextResponse.json({
error:e.message
})

}

}