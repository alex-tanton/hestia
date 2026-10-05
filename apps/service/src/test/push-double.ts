/*
 * The recording transport lives in src/push so the E2E stack can select it at runtime; tests import
 * it from here, which keeps their imports where they were.
 */
export { RecordingPushTransport } from '../push/recording-transport.js';
