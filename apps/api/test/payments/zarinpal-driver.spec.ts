import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZarinpalCheckoutDriver } from '../../src/payments/gateway/zarinpal-checkout.driver';
import { GatewayUnavailableError } from '../../src/payments/gateway/zarinpal.types';

const mocks = vi.hoisted(() => ({ create: vi.fn(), request: vi.fn(), verify: vi.fn() }));
vi.mock('zarinpal-checkout', () => ({ createWithOptions: mocks.create }));

const MERCHANT = '11111111-1111-4111-8111-111111111111';
const AUTHORITY = 'A00000000000000000000000000012345678';

function driver(sandbox = false) {
  return new ZarinpalCheckoutDriver({ get: () => sandbox } as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockReturnValue({ PaymentRequest: mocks.request, PaymentVerification: mocks.verify });
});

describe('request', () => {
  const input = {
    merchantId: MERCHANT,
    amount: 250_000,
    callbackUrl: 'https://shop.example.com/payment/callback',
    description: 'سفارش شماره 1001',
    mobile: '09121234567',
  };

  it('creates a toman client per merchant and maps a successful response', async () => {
    mocks.request.mockResolvedValue({
      status: 100,
      authority: AUTHORITY,
      url: `https://www.zarinpal.com/pg/StartPay/${AUTHORITY}`,
    });

    const res = await driver().request(input);

    expect(res).toEqual({
      kind: 'ok',
      authority: AUTHORITY,
      paymentUrl: `https://www.zarinpal.com/pg/StartPay/${AUTHORITY}`,
    });
    expect(mocks.create).toHaveBeenCalledWith(MERCHANT, { sandbox: false, currency: 'IRT', timeoutMs: 8000 });
    expect(mocks.request).toHaveBeenCalledWith({
      Amount: 250_000,
      CallbackURL: 'https://shop.example.com/payment/callback',
      Description: 'سفارش شماره 1001',
      Mobile: '09121234567',
    });
  });

  it('passes the sandbox flag and omits an empty mobile', async () => {
    mocks.request.mockResolvedValue({ status: 100, authority: AUTHORITY, url: 'https://x.test/pay' });
    await driver(true).request({ ...input, mobile: undefined });

    expect(mocks.create).toHaveBeenCalledWith(MERCHANT, expect.objectContaining({ sandbox: true }));
    expect(mocks.request.mock.calls[0]![0]).not.toHaveProperty('Mobile');
  });

  it('reports a definitive rejection', async () => {
    mocks.request.mockResolvedValue({ status: -9 });
    expect(await driver().request(input)).toMatchObject({ kind: 'rejected', code: -9 });
  });

  it('treats a missing authority as a rejection, not a success', async () => {
    mocks.request.mockResolvedValue({ status: 100 });
    expect(await driver().request(input)).toMatchObject({ kind: 'rejected', code: 100 });
  });

  it('treats thrown errors and unreadable responses as undetermined', async () => {
    mocks.request.mockRejectedValue(new Error('socket hang up'));
    await expect(driver().request(input)).rejects.toBeInstanceOf(GatewayUnavailableError);

    for (const garbage of [{}, null, undefined, 'oops', { status: 'ok' }]) {
      mocks.request.mockResolvedValue(garbage);
      await expect(driver().request(input)).rejects.toBeInstanceOf(GatewayUnavailableError);
    }
  });

  it('never puts the merchant id in an error message', async () => {
    mocks.request.mockRejectedValue(new Error(`bad merchant ${MERCHANT}`));
    const error = await driver().request(input).catch((e: Error) => e);
    expect((error as Error).message).not.toContain(MERCHANT);
  });
});

describe('verify', () => {
  const input = { merchantId: MERCHANT, authority: AUTHORITY, amount: 250_000 };

  it('maps code 100 and 101 (already verified) to verified', async () => {
    mocks.verify.mockResolvedValueOnce({ status: 100, RefID: 123456789 });
    expect(await driver().verify(input)).toEqual({ kind: 'verified', code: 100, refId: '123456789', cardPan: null });

    mocks.verify.mockResolvedValueOnce({ status: 101, RefID: '123456789', cardPan: '603799******1234' });
    expect(await driver().verify(input)).toEqual({
      kind: 'verified',
      code: 101,
      refId: '123456789',
      cardPan: '603799******1234',
    });
    expect(mocks.verify).toHaveBeenCalledWith({ Amount: 250_000, Authority: AUTHORITY });
  });

  it('reports a definitive rejection', async () => {
    mocks.verify.mockResolvedValue({ status: -51 });
    expect(await driver().verify(input)).toMatchObject({ kind: 'rejected', code: -51 });
  });

  it('treats thrown errors and unreadable responses as undetermined', async () => {
    mocks.verify.mockRejectedValue(new Error('timeout'));
    await expect(driver().verify(input)).rejects.toBeInstanceOf(GatewayUnavailableError);

    mocks.verify.mockResolvedValue({});
    await expect(driver().verify(input)).rejects.toBeInstanceOf(GatewayUnavailableError);
  });
});