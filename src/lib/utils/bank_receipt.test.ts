import { describe, it } from 'vitest';
import { buildSingleReceipt } from '$lib/utils/pdf';
import fs from 'node:fs';
import type { Party, Transaction } from '$lib/types';

describe('render test receipt with bank details', () => {
	it('saves sample_receipt_with_bank.pdf', async () => {
		const tx: Transaction = {
			id: 'test-2',
			transactionDate: new Date('2026-04-24T00:00:00'),
			purchaseType: 'purchase',
			wayNumber: '1929129',
			partyId: 'p-2',
			itemName: 'Paddy',
			load: 293923,
			empty: 28382,
			autoCalculate: true,
			total: 29393,
			bagCount: 299,
			kg: 23,
			freightCharge: 23233,
			narration: '',
			price: 1560,
			amount: 2832832,
			status: 'active',
			createdAt: null,
			updatedAt: null
		};
		const party: Party = {
			id: 'p-2',
			partyName: 'Prasanna Venkatesh',
			place: 'Pattukottai',
			phoneNumber: '9443334307',
			partyType: 'wholesale',
			accountName: 'Prasanna Venkatesh',
			accountNo: '12345678901234',
			ifscCode: 'SBIN0001234',
			bankName: 'State Bank of India',
			status: 'active',
			createdAt: null,
			updatedAt: null
		};

		const doc = await buildSingleReceipt(tx, party);
		const bytes = new Uint8Array(doc.output('arraybuffer'));
		fs.writeFileSync('C:/Users/akhil/.gemini/antigravity-ide/brain/2339e1db-b3b7-43bc-af1e-784530eb81b9/scratch/sample_receipt_with_bank.pdf', Buffer.from(bytes));
	});
});
