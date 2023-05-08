abstract class SignalHistoryClientError extends Error {
    abstract code: string;
  
    constructor(message: string) {
      super(message);
  
      // Set the prototype explicitly, required for extending built-in Error class.
      Object.setPrototypeOf(this, new.target.prototype);
  
      // Capture the stack trace, excluding the constructor call.
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
      }
    }
  }
  
  export class UnauthorizedConnectionManagementError extends SignalHistoryClientError {
    code = 'SHC_UNAUTHORIZED_CONNECTION_MANAGEMENT';
  
    constructor() {
      super(
        'Do not call SignalHistoryClient.instance.connect() or SignalHistoryClient.instance.disconnect() when manuallyManageConnectionPleaseReadTheDocsOnThis = false'
      );
    }
  }
  
  export class ConfigJsonReadError extends SignalHistoryClientError {
    code = 'SHC_CONFIG_JSON_READ_ERROR';
  
    constructor(message: string) {
      super(message);
    }
  }
  
  export class FaultyManualConnectionManagementError extends SignalHistoryClientError {
    code = 'SHC_FAULTY_MANUAL_CONNECTION_MANAGEMENT';
  
    constructor(message: string) {
      super(message);
    }
  }
  
// TODO: retries exceeded
// TODO: key file or db.sqlite does not exist
// TODO: sqlite errors like out of mem weiterreichen
// TODO: key passt nicht