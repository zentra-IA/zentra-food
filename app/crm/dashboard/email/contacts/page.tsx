"use client"

import {useEffect,useState} from "react"

export default function(){

const [contacts,setContacts]=useState<any[]>([])
const [loading,setLoading]=useState(true)

useEffect(()=>{

load()

},[])

async function load(){

const res=
await fetch(
"/api/email/contacts"
)

const data=
await res.json()

setContacts(data || [])

setLoading(false)

}

async function enviarTeste(email:string){

const res=await fetch(
"/api/email/send-test",
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({

to:email,

subject:
"Sua consulta FGTS pode ter mudado",

html:`
<h1>Consulta FGTS</h1>

<p>
Verificamos uma atualização recente.
</p>

<a href="https://wa.me/551199999999">

Falar no WhatsApp

</a>

`

})
}
)

const data=
await res.json()

alert(
data.success
?
"Email enviado"
:
data.error
)

}

if(loading){

return(
<div className="p-6 text-white">
Carregando...
</div>
)

}

return(

<div className="p-6 text-white">

<h1 className="text-4xl font-bold">

Contatos Email

</h1>

<p className="mb-8">

Total:
{contacts.length}

</p>

<div className="space-y-4">

{contacts.map((c:any)=>(

<div
key={c.id}
className="
bg-zinc-900
border
border-zinc-800
rounded-xl
p-4
"
>

<div className="font-bold">

{c.nome}

</div>

<div className="text-zinc-400">

{c.email}

</div>

<button
onClick={()=>
enviarTeste(
c.email
)
}
className="
mt-4
bg-green-600
px-4
py-2
rounded
"
>

Enviar teste

</button>

</div>

)
)}

</div>

</div>

)

}