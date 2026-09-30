export type Status = 'active' | 'inactive';
export type PurchaseType = 'purchase' | 'return';
/** Wholesale parties are billed for full bags only; farmers are also paid for the loose kg. */
export type PartyType = 'wholesale' | 'farmer';

export const PARTY_TYPE_OPTIONS: { value: PartyType; label: string }[] = [
	{ value: 'wholesale', label: 'Wholesale' },
	{ value: 'farmer', label: 'Farmer' }
];

export const STATUS_OPTIONS: { value: Status; label: string }[] = [
	{ value: 'active', label: 'Active' },
	{ value: 'inactive', label: 'Inactive' }
];

export const PURCHASE_TYPE_OPTIONS: { value: PurchaseType; label: string }[] = [
	{ value: 'purchase', label: 'Purchase' },
	{ value: 'return', label: 'Return' }
];

export const PAGE_SIZES = [20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

export interface Party {
	id: string;
	partyName: string;
	place: string;
	phoneNumber: string;
	partyType: PartyType;
	status: Status;
	createdAt: Date | null;
	updatedAt: Date | null;
}

export interface PartyInput {
	partyName: string;
	place: string;
	phoneNumber: string;
	partyType: PartyType;
	status: Status;
}

export interface Transaction {
	id: string;
	transactionDate: Date;
	purchaseType: PurchaseType;
	wayNumber: string;
	partyId: string;
	itemName: string;
	/** Null only on manually entered entries where Load/Empty were left blank. */
	load: number | null;
	empty: number | null;
	/** True: Total/Bags/Kg derived from Load − Empty. False: Total and Bags typed by the user. */
	autoCalculate: boolean;
	total: number;
	bagCount: number;
	kg: number;
	freightCharge: number;
	narration: string;
	price: number;
	amount: number;
	status: Status;
	createdAt: Date | null;
	updatedAt: Date | null;
}

/** Raw values from the transaction form (numbers are null when left blank). */
export interface TransactionFormValues {
	transactionDate: string; // YYYY-MM-DD
	purchaseType: PurchaseType | '';
	wayNumber: string;
	partyId: string;
	itemName: string;
	load: number | null;
	empty: number | null;
	autoCalculate: boolean;
	/** Typed weights — used only when autoCalculate is off, where nothing is derived. */
	total: number | null;
	bagCount: number | null;
	kg: number | null;
	freightCharge: number | null;
	narration: string;
	/** Price per bag. The loose-kg rate and both amounts are derived from it. */
	price: number | null;
	status: Status;
}

/** Validated transaction with calculated fields, ready to persist. */
export type TransactionData = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;

export interface TransactionFilters {
	dateFrom: string; // YYYY-MM-DD or ''
	dateTo: string;
	search: string; // party name or phone
	status: Status | '';
}

export const EMPTY_FILTERS: TransactionFilters = { dateFrom: '', dateTo: '', search: '', status: '' };
