import { getMetadataArgsStorage } from 'typeorm';
import { User } from './user.entity';

/**
 * Guards the one property that stops bcrypt hashes reaching API clients.
 *
 * Before `select: false`, every `leftJoinAndSelect('x.user', …)` and every
 * `relations: ['user']` in the codebase returned `passwordHash` — `GET /cases`
 * and `GET /bills/admin` both did, in production shape. The defence was a
 * hand-written `const { passwordHash: _, ...rest }` at each response site, which
 * a joined relation gives you nowhere to put.
 *
 * Deleting the flag would reopen all of it silently: nothing would fail to
 * compile, no endpoint would change status code, and the hash would simply
 * reappear in responses. Hence a test that fails loudly instead.
 */
describe('User.passwordHash', () => {
  const column = getMetadataArgsStorage().columns.find(
    (c) => c.target === User && c.propertyName === 'passwordHash',
  );

  it('is declared on the entity', () => {
    expect(column).toBeDefined();
  });

  it('is never selected unless a query names it', () => {
    expect(column?.options?.select).toBe(false);
  });

  /**
   * The corollary: a column that is `select: false` must still be nullable and
   * writable, because social-login accounts have no password at all and the
   * reset flows overwrite it through an ordinary save.
   */
  it('stays nullable so social-login accounts remain valid', () => {
    expect(column?.options?.nullable).toBe(true);
  });
});
