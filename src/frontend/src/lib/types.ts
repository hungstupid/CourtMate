export type Court = {
  id: string
  owner_id: string
  name: string
  sport: string
  address: string
  area: string
  description: string
  contact: string
  photo_urls: string[]
  base_price_vnd: number
  max_players: number
  active: boolean
  version: number
}
export type Offer = {
  id: string
  slot_id: string
  mode: 'manual' | 'automatic'
  status: 'SCHEDULED' | 'ACTIVE' | 'CANCELLED' | 'DEACTIVATED' | 'EXPIRED'
  price_vnd: number
  regular_price_vnd: number
  lead_hours: string | number
  applies_at: string
  eligible: boolean
  reason: string | null
}
export type Slot = {
  id: string
  court_id: string
  playing_date: string
  start_at: string
  end_at: string
  price_vnd: number
  regular_price_vnd?: number
  published: boolean
  blocked: boolean
  version: number
  status: string
  offer?: Offer | null
}
export type Maintenance = { id: string; start_at: string; end_at: string }
export type Availability = {
  court_id: string
  server_now: string
  playing_date: string
  slots: Slot[]
  maintenance: Maintenance[]
}
export type Review = {
  court_id: string
  slot_ids: string[]
  slots: Pick<Slot, 'id' | 'start_at' | 'end_at' | 'price_vnd'>[]
  start_at: string
  end_at: string
  duration_minutes: number
  total_price_vnd: number
  quote: string
}
export type Booking = {
  id: string
  court_id: string
  court_name: string
  court_max_players: number
  room_id: string | null
  start_at: string
  end_at: string
  status: string
  total_price_vnd: number
  created_at: string
  can_create_room?: boolean
  can_cancel?: boolean
  cancellation_reason?: string | null
  slots: {
    slot_id: string
    start_at: string
    end_at: string
    price_vnd: number
  }[]
  player_contact?: {
    registration_email: string | null
    display_name: string | null
  }
}
export type Room = {
  id: string
  booking_id: string
  organizer_id: string
  court_id: string
  court_name: string
  sport: string
  address: string
  area: string
  start_at: string
  end_at: string
  capacity: number
  member_count: number
  remaining_places: number
  status: 'OPEN' | 'FULL' | 'CLOSED'
  estimated_share_vnd: number | null
  closed_reason?: string | null
  members: {
    display_name: string | null
    is_organizer: boolean
    is_self?: boolean
  }[]
  is_member?: boolean
  is_organizer?: boolean
}
export type Hours = {
  weekday: number
  opens_minute: number
  closes_minute: number
}
export type Profile = {
  display_name: string
  contact_preferences: string
  registration_email: string | null
  role: string
}
