import { Resend } from "resend"

const resend=new Resend(
process.env.RESEND_API_KEY
)

export async function POST(req:Request){

try{

const body=
await req.json()

for(const contact of body.contacts){

await resend.emails.send({

from:
process.env.EMAIL_FROM!,

to:contact.email,

subject:body.subject,

html:`

<div>

<h2>
Olá ${contact.nome}
</h2>

${body.html}

</div>

`

})

}

return Response.json({

success:true

})

}catch(e:any){

return Response.json({

success:false,

error:e.message

})

}

}