/** Boots the test fixture site standalone (for the acceptance sequence). */
import { startFixtureSite } from '../test/fixtures/site.js';

const site = await startFixtureSite();
console.log(site.baseUrl);
