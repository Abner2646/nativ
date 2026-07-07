// src/app/api/admin/route.ts
import { NextRequest } from 'next/server'
import {
  getReservations, updateReservation,
  getGuests, updateGuest, addGuestTag, removeGuestTag,
  getShifts, createShift, updateShift, deleteShift,
  getAreas, createArea, updateArea, deleteArea,
  getTables, createTable, updateTable, deleteTable,
  getServiceState, seatReservation, finishReservation,
  createWalkIn, assignTable, unassignTable,
  getCombos, createCombo, deleteCombo,
  getBlockedDates, createBlockedDate, deleteBlockedDate,
  getSpecialEvents, createSpecialEvent, deleteSpecialEvent,
  getSettings, updateSettings, getStats,
  getEmployees, inviteEmployee, removeEmployee,
  getCampaigns, updateCampaign,
  getBirthdayConfig, updateBirthdayConfig,
  getReferrals,
  getDepositRules, createDepositRule, deleteDepositRule,
  getStripeConnectStatus, createStripeConnectLink,
} from '@/routes/admin.routes'

export async function GET(req: NextRequest) {
  const r = new URL(req.url).searchParams.get('resource')
  switch (r) {
    case 'reservations':    return getReservations(req)
    case 'guests':          return getGuests(req)
    case 'shifts':          return getShifts(req)
    case 'areas':           return getAreas(req)
    case 'tables':          return getTables(req)
    case 'service':         return getServiceState(req)
    case 'combos':          return getCombos(req)
    case 'blocked-dates':   return getBlockedDates(req)
    case 'events':          return getSpecialEvents(req)
    case 'settings':        return getSettings(req)
    case 'stats':           return getStats(req)
    case 'employees':       return getEmployees(req)
    case 'campaigns':       return getCampaigns(req)
    case 'birthday-config': return getBirthdayConfig(req)
    case 'referrals':       return getReferrals(req)
    case 'deposit-rules':   return getDepositRules(req)
    case 'stripe-connect':  return getStripeConnectStatus(req)
    default: return Response.json({ error: 'Unknown resource' }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  const r = new URL(req.url).searchParams.get('resource')
  switch (r) {
    case 'shifts':        return createShift(req)
    case 'areas':         return createArea(req)
    case 'tables':        return createTable(req)
    case 'seat':          return seatReservation(req)
    case 'finish':        return finishReservation(req)
    case 'walk-in':       return createWalkIn(req)
    case 'assign-table':  return assignTable(req)
    case 'combos':        return createCombo(req)
    case 'blocked-dates': return createBlockedDate(req)
    case 'events':        return createSpecialEvent(req)
    case 'employees':     return inviteEmployee(req)
    case 'guest-tag':     return addGuestTag(req)
    case 'deposit-rules': return createDepositRule(req)
    case 'stripe-connect': return createStripeConnectLink(req)
    default: return Response.json({ error: 'Unknown resource' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  const r = new URL(req.url).searchParams.get('resource')
  switch (r) {
    case 'reservations':    return updateReservation(req)
    case 'guests':          return updateGuest(req)
    case 'shifts':          return updateShift(req)
    case 'areas':           return updateArea(req)
    case 'tables':          return updateTable(req)
    case 'settings':        return updateSettings(req)
    case 'campaigns':       return updateCampaign(req)
    case 'birthday-config': return updateBirthdayConfig(req)
    default: return Response.json({ error: 'Unknown resource' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const r = new URL(req.url).searchParams.get('resource')
  switch (r) {
    case 'shifts':        return deleteShift(req)
    case 'areas':         return deleteArea(req)
    case 'tables':        return deleteTable(req)
    case 'assign-table':  return unassignTable(req)
    case 'combos':        return deleteCombo(req)
    case 'blocked-dates': return deleteBlockedDate(req)
    case 'events':        return deleteSpecialEvent(req)
    case 'employees':     return removeEmployee(req)
    case 'guest-tag':     return removeGuestTag(req)
    case 'deposit-rules': return deleteDepositRule(req)
    default: return Response.json({ error: 'Unknown resource' }, { status: 400 })
  }
}
