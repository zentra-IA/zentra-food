import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      message,
      images,
      whatsappAccounts,
    } = body

    const { data, error } =
      await supabase
        .from('campaigns')
        .insert({
          message,
          images,
          whatsapp_accounts:
            whatsappAccounts,
          status: 'running',
        })
        .select('*')
        .single()

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
      })
    }

    return NextResponse.json({
      success: true,
      campaign: data,
    })
  } catch (error: any) {
    console.error(error)

    return NextResponse.json({
      success: false,
      error:
        error.message ||
        'Erro interno',
    })
  }
}