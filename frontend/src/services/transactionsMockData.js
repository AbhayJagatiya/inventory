// Mock State and Ledger Management for Stock Movement Transactions (Phase 4)
// Supports full in-browser interactive verification with atomic balance checks,
// audit preservation, duplicate posting prevention, and local persistence.

import { MOCK_ITEMS } from './mockData'

const STORAGE_KEY_RECEIPTS = 'dsims_tx_receipts_v1'
const STORAGE_KEY_ISSUES = 'dsims_tx_issues_v1'
const STORAGE_KEY_RETURNS = 'dsims_tx_returns_v1'
const STORAGE_KEY_TRANSFERS = 'dsims_tx_transfers_v1'
const STORAGE_KEY_ITEMS = 'dsims_tx_items_v1'

// ─── Initial Seed Data ────────────────────────────────────────────────────────
const SEED_RECEIPTS = [
  {
    id: 'rcv-001',
    voucher_number: 'RCV-GS-VRV-2026-00018',
    receipt_date: '2026-10-24',
    supplier_name: 'Gujarat Infotech Solutions Pvt Ltd',
    supplier_contact: '+91 98250 11223',
    po_number: 'GEM-2026-PO-8812',
    invoice_number: 'INV-GIS-2026-441',
    invoice_date: '2026-10-22',
    receiving_office: 'District Panchayat Central Store, Veraval',
    receiving_location: 'Room 102 (Central Store)',
    receiving_officer: 'R. K. Parmar (Store Officer)',
    status: 'POSTED',
    posted_at: '2026-10-24T14:30:00.000Z',
    posted_by: 'R. K. Parmar',
    remarks: 'Delivered in good condition via GeM delivery challan. Quality verified.',
    attachment_name: 'GeM_Challan_8812.pdf',
    items: [
      {
        id: 'rcv-itm-001',
        item_name: 'HP LaserJet Pro MFP 4104dw Printer',
        item_type: 'DURABLE_ASSET',
        category_name: 'Computers & Peripherals',
        uom: 'NOS',
        quantity_ordered: 2,
        quantity_received: 2,
        quantity_accepted: 2,
        quantity_rejected: 0,
        rejection_reason: '',
        unit_cost: 38500,
        total_accepted_cost: 77000,
        serial_numbers: ['VNB3K94021', 'VNB3K94022'],
      },
      {
        id: 'rcv-itm-002',
        item_name: 'JK Copier A4 Paper Reams (75 GSM)',
        item_type: 'CONSUMABLE_STOCK',
        category_name: 'Office Stationery & Paper',
        uom: 'REAM',
        quantity_ordered: 100,
        quantity_received: 100,
        quantity_accepted: 95,
        quantity_rejected: 5,
        rejection_reason: '5 reams water-damaged in transit carton',
        unit_cost: 320,
        total_accepted_cost: 30400,
      },
    ],
    total_accepted_value: 107400,
  },
  {
    id: 'rcv-002',
    voucher_number: 'RCV-GS-VRV-2026-00019',
    receipt_date: '2026-11-01',
    supplier_name: 'Sardar Stationery Mart, Veraval',
    supplier_contact: '+91 94264 55889',
    po_number: 'GEM-2026-PO-9004',
    invoice_number: 'SSM-VRV-2026-092',
    invoice_date: '2026-10-31',
    receiving_office: 'District Panchayat Central Store, Veraval',
    receiving_location: 'Room 101 (Stationery Rack A)',
    receiving_officer: 'Hitesh Barad (Store Clerk)',
    status: 'DRAFT',
    remarks: 'Challan verified, pending physical count verification by Store Officer.',
    attachment_name: 'Delivery_Slip_SSM.pdf',
    items: [
      {
        id: 'rcv-itm-003',
        item_name: 'Cello Gripper Ballpoint Pens (Blue - Box of 50)',
        item_type: 'CONSUMABLE_STOCK',
        category_name: 'Office Stationery & Paper',
        uom: 'BOX',
        quantity_ordered: 40,
        quantity_received: 40,
        quantity_accepted: 40,
        quantity_rejected: 0,
        rejection_reason: '',
        unit_cost: 450,
        total_accepted_cost: 18000,
      },
    ],
    total_accepted_value: 18000,
  },
]

const SEED_ISSUES = [
  {
    id: 'iss-001',
    voucher_number: 'ISS-GS-VRV-2026-00014',
    issue_date: '2026-10-28',
    department: 'Accounts & Audit Branch',
    receiving_employee: 'Ramesh Dave',
    receiving_designation: 'Head Accountant',
    sanction_order_number: 'DDO/GS/ACC/2026/102',
    purpose: 'Quarterly financial audit operations and ledger compilation desk',
    status: 'POSTED',
    posted_at: '2026-10-28T11:15:00.000Z',
    issued_by: 'R. K. Parmar',
    remarks: 'Approved by Deputy DDO. Issued from central store.',
    items: [
      {
        id: 'iss-itm-001',
        item_id: 'itm-001',
        item_code: 'AST-GS-VRV-2024-00012',
        item_name: 'HP LaserJet Pro MFP 4104dw Printer',
        item_type: 'DURABLE_ASSET',
        serial_number: 'VNB3K94021',
        uom: 'NOS',
        quantity_issued: 1,
        quantity_returned: 0,
        remaining_unreturned: 1,
      },
      {
        id: 'iss-itm-002',
        item_id: 'itm-003',
        item_code: 'ITM-GS-VRV-2024-00088',
        item_name: 'JK Copier A4 Paper Reams (75 GSM)',
        item_type: 'CONSUMABLE_STOCK',
        uom: 'REAM',
        quantity_issued: 15,
        quantity_returned: 5,
        remaining_unreturned: 10,
      },
    ],
  },
  {
    id: 'iss-002',
    voucher_number: 'ISS-GS-VRV-2026-00015',
    issue_date: '2026-11-02',
    department: 'Establishment Branch',
    receiving_employee: 'V. P. Vala',
    receiving_designation: 'Senior Clerk',
    sanction_order_number: 'DDO/GS/EST/2026/49',
    purpose: 'New staff deployment setup for clerical documentation desk',
    status: 'POSTED',
    posted_at: '2026-11-02T16:00:00.000Z',
    issued_by: 'Hitesh Barad',
    remarks: 'Durable asset handed over in good working condition.',
    items: [
      {
        id: 'iss-itm-003',
        item_id: 'itm-007',
        item_code: 'AST-GS-VRV-2021-00033',
        item_name: 'High-Back Ergonomic Revolving Chair',
        item_type: 'DURABLE_ASSET',
        serial_number: 'FTL-CH-2021',
        uom: 'NOS',
        quantity_issued: 1,
        quantity_returned: 0,
        remaining_unreturned: 1,
      },
    ],
  },
]

const SEED_RETURNS = [
  {
    id: 'ret-001',
    voucher_number: 'RET-GS-VRV-2026-00007',
    return_date: '2026-11-03',
    original_issue_id: 'iss-001',
    original_issue_voucher: 'ISS-GS-VRV-2026-00014',
    returning_department: 'Accounts & Audit Branch',
    returning_employee: 'Ramesh Dave (Head Accountant)',
    receiving_officer: 'R. K. Parmar (Store Officer)',
    return_reason: 'Audit cycle completed; surplus unopened stationery returned to store',
    status: 'POSTED',
    posted_at: '2026-11-03T10:45:00.000Z',
    posted_by: 'R. K. Parmar',
    items: [
      {
        id: 'ret-itm-001',
        item_id: 'itm-003',
        item_code: 'ITM-GS-VRV-2024-00088',
        item_name: 'JK Copier A4 Paper Reams (75 GSM)',
        item_type: 'CONSUMABLE_STOCK',
        uom: 'REAM',
        quantity_returned: 5,
        condition: 'GOOD',
        inspection_notes: 'Original packaging intact. Re-admitted to active stock balance.',
        flagged_for_maintenance: false,
      },
    ],
  },
]

const SEED_TRANSFERS = [
  {
    id: 'trf-001',
    transfer_number: 'TRF-GS-VRV-2026-00003',
    request_date: '2026-10-29',
    transfer_type: 'PERMANENT',
    source_office: 'District Panchayat Central Store, Veraval',
    destination_office: 'Talala Taluka Panchayat Store',
    destination_location: 'Talala Store Room 1',
    order_reference: 'DDO/GS/TRF/2026/88',
    reason: 'Inter-taluka administrative asset reallocation as per District Development directive',
    status: 'IN_TRANSIT',
    requested_by: 'Hitesh Barad',
    approved_by: 'R. K. Parmar (Store Officer)',
    approved_at: '2026-10-30T12:00:00.000Z',
    dispatched_at: '2026-11-01T09:30:00.000Z',
    dispatched_by: 'R. K. Parmar',
    carrier_name: 'Gujarat State Road Transport Parcel Service',
    waybill_number: 'GSRTC-VRV-9021',
    expected_delivery_date: '2026-11-04',
    items: [
      {
        id: 'trf-itm-001',
        item_id: 'itm-002',
        item_code: 'AST-GS-VRV-2023-00045',
        item_name: 'Dell OptiPlex 7090 Desktop Computer',
        item_type: 'DURABLE_ASSET',
        serial_number: '8XPT2M3',
        quantity: 1,
        uom: 'NOS',
      },
    ],
  },
  {
    id: 'trf-002',
    transfer_number: 'TRF-GS-VRV-2026-00004',
    request_date: '2026-11-02',
    transfer_type: 'TEMPORARY',
    expected_return_date: '2026-11-30',
    source_office: 'District Panchayat Central Store, Veraval',
    destination_office: 'Kodinar Branch Store',
    destination_location: 'Kodinar Meeting Hall',
    order_reference: 'DDO/GS/TRF/2026/91',
    reason: 'Temporary loan for Panchayati Raj regional workshop presentation setup',
    status: 'SUBMITTED',
    requested_by: 'Hitesh Barad',
    items: [
      {
        id: 'trf-itm-002',
        item_id: 'itm-001',
        item_code: 'AST-GS-VRV-2024-00012',
        item_name: 'HP LaserJet Pro MFP 4104dw Printer',
        item_type: 'DURABLE_ASSET',
        serial_number: 'VNB3K94021',
        quantity: 1,
        uom: 'NOS',
      },
    ],
  },
]

// ─── Helpers: Persistent State Accessors ─────────────────────────────────────
function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore parse error
  }
  return fallback
}

function saveToStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // ignore quota error
  }
}

export function getMockReceipts() {
  return loadFromStorage(STORAGE_KEY_RECEIPTS, SEED_RECEIPTS)
}

export function getMockIssues() {
  return loadFromStorage(STORAGE_KEY_ISSUES, SEED_ISSUES)
}

export function getMockReturns() {
  return loadFromStorage(STORAGE_KEY_RETURNS, SEED_RETURNS)
}

export function getMockTransfers() {
  return loadFromStorage(STORAGE_KEY_TRANSFERS, SEED_TRANSFERS)
}

export function getMockItemsState() {
  return loadFromStorage(STORAGE_KEY_ITEMS, MOCK_ITEMS)
}

// ─── Module 1: Receipts Actions ──────────────────────────────────────────────
export function saveMockReceipt(receiptData) {
  const receipts = getMockReceipts()
  const now = new Date()
  const year = now.getFullYear()
  const randNum = String(receipts.length + 19).padStart(5, '0')
  const voucherNumber = receiptData.voucher_number || `RCV-GS-VRV-${year}-${randNum}`

  const newReceipt = {
    ...receiptData,
    id: `rcv-${Date.now()}`,
    voucher_number: voucherNumber,
    created_at: now.toISOString(),
    status: receiptData.status || 'DRAFT',
  }

  const updated = [newReceipt, ...receipts]
  saveToStorage(STORAGE_KEY_RECEIPTS, updated)

  // If created directly as POSTED, update stock
  if (newReceipt.status === 'POSTED') {
    applyReceiptStockUpdate(newReceipt)
  }

  return newReceipt
}

export function postMockReceipt(receiptId, currentUser = 'Store Officer') {
  const receipts = getMockReceipts()
  const index = receipts.findIndex((r) => r.id === receiptId || r.voucher_number === receiptId)

  if (index === -1) throw new Error('Receipt voucher not found')
  if (receipts[index].status === 'POSTED') throw new Error('Receipt is already posted. Duplicate confirmation is prevented.')

  const target = receipts[index]
  target.status = 'POSTED'
  target.posted_at = new Date().toISOString()
  target.posted_by = currentUser

  receipts[index] = target
  saveToStorage(STORAGE_KEY_RECEIPTS, receipts)

  applyReceiptStockUpdate(target)
  return target
}

function applyReceiptStockUpdate(receipt) {
  const items = getMockItemsState()

  receipt.items.forEach((line) => {
    if (line.item_type === 'CONSUMABLE_STOCK') {
      const existing = items.find((itm) => itm.item_name.toLowerCase() === line.item_name.toLowerCase())
      if (existing) {
        existing.quantity = (existing.quantity || 0) + (Number(line.quantity_accepted) || 0)
        existing.last_movement_date = new Date().toISOString().split('T')[0]
      } else {
        items.push({
          id: `itm-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          item_code: `ITM-GS-VRV-${Date.now().toString().slice(-5)}`,
          barcode_number: `BC-ITM-${Date.now().toString().slice(-5)}`,
          item_name: line.item_name,
          item_type: 'CONSUMABLE_STOCK',
          category: { name: line.category_name || 'Office Stationery & Paper' },
          location: { room_number: 'Room 101', description: 'Central Store' },
          quantity: Number(line.quantity_accepted) || 0,
          uom: line.uom || 'NOS',
          unit_purchase_cost: Number(line.unit_cost) || 0,
          total_purchase_cost: (Number(line.quantity_accepted) || 0) * (Number(line.unit_cost) || 0),
          purchase_date: receipt.receipt_date,
          condition: 'GOOD',
          operational_status: 'AVAILABLE_IN_STORE',
          classification: 'ACTIVE',
          last_movement_date: new Date().toISOString().split('T')[0],
        })
      }
    } else if (line.item_type === 'DURABLE_ASSET') {
      const serials = line.serial_numbers || []
      const acceptedCount = Number(line.quantity_accepted) || 1

      for (let i = 0; i < acceptedCount; i++) {
        const serial = serials[i] || `SN-RCV-${Date.now()}-${i + 1}`
        items.unshift({
          id: `itm-${Date.now()}-${i}`,
          item_code: `AST-GS-VRV-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}${i}`,
          barcode_number: `BC-AST-${Date.now().toString().slice(-5)}${i}`,
          item_name: line.item_name,
          item_type: 'DURABLE_ASSET',
          category: { name: line.category_name || 'General Durable Asset' },
          location: { room_number: 'Room 102', description: 'Central Store Bay' },
          serial_number: serial,
          quantity: 1,
          uom: line.uom || 'NOS',
          unit_purchase_cost: Number(line.unit_cost) || 0,
          total_purchase_cost: Number(line.unit_cost) || 0,
          purchase_date: receipt.receipt_date,
          condition: 'GOOD',
          operational_status: 'AVAILABLE_IN_STORE',
          classification: 'ACTIVE',
          current_custodian: null,
          current_department: 'Store Department',
          last_movement_date: new Date().toISOString().split('T')[0],
        })
      }
    }
  })

  saveToStorage(STORAGE_KEY_ITEMS, items)
}

// ─── Module 2: Issues Actions ────────────────────────────────────────────────
export function saveMockIssue(issueData, currentUser = 'Store Staff') {
  const issues = getMockIssues()
  const items = getMockItemsState()

  // Validate stock balances
  issueData.items.forEach((line) => {
    const item = items.find((i) => i.id === line.item_id || i.item_code === line.item_code)
    if (!item) throw new Error(`Item ${line.item_name} not found in store register`)

    if (item.item_type === 'CONSUMABLE_STOCK') {
      if ((item.quantity || 0) < Number(line.quantity_issued)) {
        throw new Error(`Insufficient stock for ${item.item_name}. Available: ${item.quantity} ${item.uom}, Requested: ${line.quantity_issued}`)
      }
    } else if (item.item_type === 'DURABLE_ASSET') {
      if (item.operational_status !== 'AVAILABLE_IN_STORE') {
        throw new Error(`Asset ${item.item_name} (${item.item_code}) is not available in store (Status: ${item.operational_status})`)
      }
    }
  })

  const now = new Date()
  const year = now.getFullYear()
  const randNum = String(issues.length + 15).padStart(5, '0')
  const voucherNumber = issueData.voucher_number || `ISS-GS-VRV-${year}-${randNum}`

  const newIssue = {
    ...issueData,
    id: `iss-${Date.now()}`,
    voucher_number: voucherNumber,
    created_at: now.toISOString(),
    status: 'POSTED',
    posted_at: now.toISOString(),
    issued_by: currentUser,
  }

  // Atomically update inventory
  issueData.items.forEach((line) => {
    const item = items.find((i) => i.id === line.item_id || i.item_code === line.item_code)
    if (item.item_type === 'CONSUMABLE_STOCK') {
      item.quantity = Math.max(0, (item.quantity || 0) - Number(line.quantity_issued))
      item.last_movement_date = now.toISOString().split('T')[0]
    } else if (item.item_type === 'DURABLE_ASSET') {
      item.operational_status = 'IN_USE'
      item.current_custodian = `${newIssue.receiving_employee} (${newIssue.receiving_designation || 'Staff'})`
      item.current_department = newIssue.department
      item.last_movement_date = now.toISOString().split('T')[0]
    }
  })

  saveToStorage(STORAGE_KEY_ITEMS, items)
  saveToStorage(STORAGE_KEY_ISSUES, [newIssue, ...issues])

  return newIssue
}

// ─── Module 3: Returns Actions ────────────────────────────────────────────────
export function saveMockReturn(returnData, currentUser = 'Store Officer') {
  const returns = getMockReturns()
  const issues = getMockIssues()
  const items = getMockItemsState()

  const issue = issues.find((i) => i.id === returnData.original_issue_id || i.voucher_number === returnData.original_issue_voucher)
  if (!issue) throw new Error('Original issue voucher not found.')

  // Validate quantities against outstanding issued quantity
  returnData.items.forEach((retLine) => {
    const origLine = issue.items.find((il) => il.item_id === retLine.item_id || il.item_code === retLine.item_code)
    if (!origLine) throw new Error(`Item ${retLine.item_name} was not part of original issue ${issue.voucher_number}`)

    const outstanding = (origLine.quantity_issued || 0) - (origLine.quantity_returned || 0)
    if (Number(retLine.quantity_returned) > outstanding) {
      throw new Error(`Cannot return ${retLine.quantity_returned} ${origLine.uom} for ${retLine.item_name}. Maximum returnable is ${outstanding}.`)
    }
  })

  const now = new Date()
  const year = now.getFullYear()
  const randNum = String(returns.length + 8).padStart(5, '0')
  const voucherNumber = returnData.voucher_number || `RET-GS-VRV-${year}-${randNum}`

  const newReturn = {
    ...returnData,
    id: `ret-${Date.now()}`,
    voucher_number: voucherNumber,
    created_at: now.toISOString(),
    status: 'POSTED',
    posted_at: now.toISOString(),
    posted_by: currentUser,
  }

  // Update original issue unreturned quantity
  returnData.items.forEach((retLine) => {
    const origLine = issue.items.find((il) => il.item_id === retLine.item_id || il.item_code === retLine.item_code)
    origLine.quantity_returned = (origLine.quantity_returned || 0) + Number(retLine.quantity_returned)
    origLine.remaining_unreturned = Math.max(0, origLine.quantity_issued - origLine.quantity_returned)

    // Update item stock / condition
    const item = items.find((i) => i.id === retLine.item_id || i.item_code === retLine.item_code)
    if (item) {
      item.last_movement_date = now.toISOString().split('T')[0]
      if (item.item_type === 'CONSUMABLE_STOCK') {
        item.quantity = (item.quantity || 0) + Number(retLine.quantity_returned)
      } else if (item.item_type === 'DURABLE_ASSET') {
        item.condition = retLine.condition || 'GOOD'
        if (retLine.condition === 'DAMAGED' || retLine.condition === 'SCRAP') {
          item.operational_status = 'UNDER_MAINTENANCE'
          item.current_custodian = null
          item.current_department = 'Store Maintenance Section'
        } else {
          item.operational_status = 'AVAILABLE_IN_STORE'
          item.current_custodian = null
          item.current_department = 'Store Department'
        }
      }
    }
  })

  saveToStorage(STORAGE_KEY_ISSUES, issues)
  saveToStorage(STORAGE_KEY_ITEMS, items)
  saveToStorage(STORAGE_KEY_RETURNS, [newReturn, ...returns])

  return newReturn
}

// ─── Module 4: Transfers Actions ──────────────────────────────────────────────
export function saveMockTransfer(transferData, currentUser = 'Store Staff') {
  const transfers = getMockTransfers()
  const now = new Date()
  const year = now.getFullYear()
  const randNum = String(transfers.length + 5).padStart(5, '0')
  const transferNumber = transferData.transfer_number || `TRF-GS-VRV-${year}-${randNum}`

  const newTransfer = {
    ...transferData,
    id: `trf-${Date.now()}`,
    transfer_number: transferNumber,
    request_date: now.toISOString().split('T')[0],
    created_at: now.toISOString(),
    status: 'SUBMITTED',
    requested_by: currentUser,
  }

  const updated = [newTransfer, ...transfers]
  saveToStorage(STORAGE_KEY_TRANSFERS, updated)
  return newTransfer
}

export function approveMockTransfer(transferId, reviewData, currentUser = 'Store Officer') {
  const transfers = getMockTransfers()
  const index = transfers.findIndex((t) => t.id === transferId || t.transfer_number === transferId)
  if (index === -1) throw new Error('Transfer record not found')

  const target = transfers[index]
  if (reviewData.action === 'REJECT') {
    target.status = 'REJECTED'
    target.rejection_reason = reviewData.reason || 'Not approved by store authority'
  } else {
    target.status = 'APPROVED'
    target.approved_by = currentUser
    target.approved_at = new Date().toISOString()
  }

  transfers[index] = target
  saveToStorage(STORAGE_KEY_TRANSFERS, transfers)
  return target
}

export function dispatchMockTransfer(transferId, dispatchData, currentUser = 'Store Officer') {
  const transfers = getMockTransfers()
  const index = transfers.findIndex((t) => t.id === transferId || t.transfer_number === transferId)
  if (index === -1) throw new Error('Transfer record not found')

  const target = transfers[index]
  target.status = 'IN_TRANSIT'
  target.dispatched_at = new Date().toISOString()
  target.dispatched_by = currentUser
  target.carrier_name = dispatchData.carrier_name || 'Official District Transport'
  target.waybill_number = dispatchData.waybill_number || `WB-${Date.now().toString().slice(-6)}`
  target.vehicle_number = dispatchData.vehicle_number || 'GJ-11-GA-1234'
  target.expected_delivery_date = dispatchData.expected_delivery_date

  transfers[index] = target
  saveToStorage(STORAGE_KEY_TRANSFERS, transfers)
  return target
}

export function completeMockTransfer(transferId, ackData, currentUser = 'Store Staff') {
  const transfers = getMockTransfers()
  const items = getMockItemsState()
  const index = transfers.findIndex((t) => t.id === transferId || t.transfer_number === transferId)
  if (index === -1) throw new Error('Transfer record not found')

  const target = transfers[index]
  target.status = 'COMPLETED'
  target.completed_at = new Date().toISOString()
  target.received_by = ackData.received_by || currentUser
  target.acknowledgement_remarks = ackData.remarks || 'Items received and verified at destination office'
  target.discrepancy_reported = !!ackData.discrepancy_reported

  // CRITICAL RULE: Asset location and custodian ONLY update at COMPLETED stage
  target.items.forEach((line) => {
    const item = items.find((i) => i.id === line.item_id || i.item_code === line.item_code)
    if (item) {
      item.office = { name: target.destination_office }
      item.location = { room_number: target.destination_location || 'Destination Store Room', description: target.destination_office }
      item.current_department = target.destination_office
      item.last_movement_date = new Date().toISOString().split('T')[0]
      if (item.item_type === 'DURABLE_ASSET') {
        item.current_custodian = target.transfer_type === 'TEMPORARY' ? `Temporary Custody: ${target.destination_office}` : null
        item.operational_status = 'AVAILABLE_IN_STORE'
      }
    }
  })

  saveToStorage(STORAGE_KEY_ITEMS, items)
  transfers[index] = target
  saveToStorage(STORAGE_KEY_TRANSFERS, transfers)
  return target
}

// ─── Module 5: Unified Transaction History ────────────────────────────────────
export function getUnifiedTransactionLedger(filters = {}) {
  const receipts = getMockReceipts()
  const issues = getMockIssues()
  const returns = getMockReturns()
  const transfers = getMockTransfers()

  const ledger = []

  // Map Receipts
  receipts.forEach((r) => {
    ledger.push({
      id: r.id,
      voucher_number: r.voucher_number,
      transaction_type: 'RECEIPT',
      date: r.receipt_date,
      created_at: r.posted_at || r.created_at || r.receipt_date,
      item_count: r.items?.length || 0,
      item_summary: r.items?.map((i) => `${i.item_name} (${i.quantity_accepted || i.quantity_received} ${i.uom})`).join(', ') || 'Receipt Items',
      source: r.supplier_name,
      destination: r.receiving_office,
      initiated_by: r.receiving_officer,
      status: r.status,
      total_value: r.total_accepted_value,
      detail_url: `/transactions/receipts/${r.id}`,
    })
  })

  // Map Issues
  issues.forEach((i) => {
    ledger.push({
      id: i.id,
      voucher_number: i.voucher_number,
      transaction_type: 'ISSUE',
      date: i.issue_date,
      created_at: i.posted_at || i.created_at || i.issue_date,
      item_count: i.items?.length || 0,
      item_summary: i.items?.map((it) => `${it.item_name} (${it.quantity_issued} ${it.uom})`).join(', ') || 'Issued Items',
      source: 'Central Store, Veraval',
      destination: `${i.department} (${i.receiving_employee})`,
      initiated_by: i.issued_by,
      status: i.status,
      detail_url: `/transactions/issues/${i.id}`,
    })
  })

  // Map Returns
  returns.forEach((ret) => {
    ledger.push({
      id: ret.id,
      voucher_number: ret.voucher_number,
      transaction_type: 'RETURN',
      date: ret.return_date,
      created_at: ret.posted_at || ret.created_at || ret.return_date,
      item_count: ret.items?.length || 0,
      item_summary: ret.items?.map((it) => `${it.item_name} (${it.quantity_returned} ${it.uom} - ${it.condition})`).join(', ') || 'Returned Items',
      source: `${ret.returning_department} (${ret.returning_employee})`,
      destination: 'Central Store, Veraval',
      initiated_by: ret.receiving_officer,
      status: ret.status,
      detail_url: `/transactions/returns/${ret.id}`,
    })
  })

  // Map Transfers
  transfers.forEach((trf) => {
    ledger.push({
      id: trf.id,
      voucher_number: trf.transfer_number,
      transaction_type: 'TRANSFER',
      date: trf.request_date,
      created_at: trf.completed_at || trf.dispatched_at || trf.approved_at || trf.created_at || trf.request_date,
      item_count: trf.items?.length || 0,
      item_summary: trf.items?.map((it) => `${it.item_name} (${it.quantity} ${it.uom})`).join(', ') || 'Transferred Items',
      source: trf.source_office,
      destination: trf.destination_office,
      initiated_by: trf.requested_by,
      status: trf.status,
      detail_url: `/transactions/transfers/${trf.id}`,
    })
  })

  // Sort by date descending
  ledger.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  // Apply filters
  let filtered = ledger
  if (filters.type && filters.type !== 'ALL') {
    filtered = filtered.filter((tx) => tx.transaction_type === filters.type)
  }
  if (filters.status && filters.status !== 'ALL') {
    filtered = filtered.filter((tx) => tx.status === filters.status)
  }
  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter(
      (tx) =>
        tx.voucher_number.toLowerCase().includes(q) ||
        tx.item_summary.toLowerCase().includes(q) ||
        tx.source.toLowerCase().includes(q) ||
        tx.destination.toLowerCase().includes(q) ||
        (tx.initiated_by && tx.initiated_by.toLowerCase().includes(q))
    )
  }

  return filtered
}

