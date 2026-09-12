/**
 * An error whose message is safe to show to the person using the app.
 *
 * Anything that is NOT a UserFacingError (a database error, an auth provider
 * error, a network failure) must be replaced with generic copy before it
 * reaches the interface, so internal detail is never rendered.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}
