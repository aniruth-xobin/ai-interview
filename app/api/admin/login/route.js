export const runtime = 'edge';

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Find the user using Supabase
    const { data: adminUser, error: findError } = await supabase
      .from('AdminUser')
      .select('*')
      .eq('username', username)
      .single()

    if (findError || !adminUser) {
      // For demo purposes: if no admin users exist in the DB, auto-create the first one
      const { count } = await supabase
        .from('AdminUser')
        .select('*', { count: 'exact', head: true })

      if (count === 0 && username === 'admin' && password === 'admin') {
        const { data: newUser } = await supabase
          .from('AdminUser')
          .insert({
            id: crypto.randomUUID(),
            username: 'admin',
            password: 'admin'
          })
          .select()
          .single()
          
        if (newUser) {
          return NextResponse.json({ success: true, user: { username: newUser.username } })
        }
      }
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Verify password
    if (adminUser.password !== password) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    return NextResponse.json({ success: true, user: { username: adminUser.username } })

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message, stack: error.stack },
      { status: 500 }
    )
  }
}
