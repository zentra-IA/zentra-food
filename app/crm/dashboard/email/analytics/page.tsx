export default function AnalyticsPage(){

return(

<div className="p-6">

<h1 className="text-3xl font-bold">
Relatórios Email
</h1>

<div className="grid md:grid-cols-4 gap-4 mt-8">

<div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
<h2 className="text-sm text-zinc-400">
Enviados hoje
</h2>

<p className="text-2xl font-bold">
0
</p>
</div>

<div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
<h2 className="text-sm text-zinc-400">
Aberturas
</h2>

<p className="text-2xl font-bold">
0
</p>
</div>

<div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
<h2 className="text-sm text-zinc-400">
Cliques
</h2>

<p className="text-2xl font-bold">
0
</p>
</div>

<div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
<h2 className="text-sm text-zinc-400">
Conversões
</h2>

<p className="text-2xl font-bold">
0
</p>
</div>

</div>

</div>

)

}