import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  locationInput,
  resolveLocation,
} from '../src/services/location.service';
test('accepts pincodes, GPS and addresses and rejects DEMO, generic codes and malformed coordinates', async () => {
  assert.deepEqual(await resolveLocation({ pincode: '560001' }), {
    pincode: '560001',
  });
  for (const input of [
    { pincode: 'DEMO' },
    { pincode: 'area1' },
    { latitude: 91, longitude: 0 },
    { latitude: 12 },
  ])
    assert.equal(locationInput.safeParse(input).success, false);
  await assert.rejects(
    resolveLocation({ latitude: 12, longitude: 77 }),
    /pincode/,
  );
  await assert.rejects(
    resolveLocation(
      { address: 'An ambiguous street' },
      { resolve: async () => [] },
    ),
    /precise/,
  );
  assert.equal(
    (
      await resolveLocation(
        { latitude: 12, longitude: 77 },
        {
          resolve: async () => [
            { pincode: '560001', latitude: 12, longitude: 77 },
          ],
        },
      )
    ).pincode,
    '560001',
  );
});
