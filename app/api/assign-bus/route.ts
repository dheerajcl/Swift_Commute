import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { route_id, bus_id, departure, arrival, price, available_seats, distances } = await request.json()

    const busResult = await query('SELECT id, capacity, bus_number FROM buses WHERE id = $1', [bus_id])
    if (busResult.rows.length === 0) {
      return NextResponse.json({ message: 'Bus not found' }, { status: 404 })
    }
    const { bus_number } = busResult.rows[0]

    const assignmentCheck = await query('SELECT id FROM schedules WHERE bus_id = $1', [bus_id])
    if (assignmentCheck.rows.length > 0) {
      return NextResponse.json({ message: 'Bus is already assigned to a route' }, { status: 400 })
    }

    await query('BEGIN')

    try {
      const scheduleResult = await query(`
        INSERT INTO schedules (bus_id, route_id, departure, arrival, price, available_seats)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [bus_id, route_id, departure, arrival, price, available_seats])

      for (const distance of distances) {
        await query(`
          INSERT INTO distances (route_id, from_stop, to_stop, distance_km)
          VALUES ($1, $2, $3, $4)
        `, [route_id, distance.from_stop, distance.to_stop, distance.distance_km])
      }

      // Commit the transaction
      await query('COMMIT')

      return NextResponse.json({ 
        success: true, 
        schedule_id: scheduleResult.rows[0].id,
        bus_number: bus_number
      })
    } catch (error) {
      // Rollback the transaction in case of error
      await query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Error assigning bus:', error)
    return NextResponse.json({ 
      message: error instanceof Error ? error.message : 'Failed to assign bus' 
    }, { status: 500 })
  }
}