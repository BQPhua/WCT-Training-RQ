/** Errors with user-safe messages. Anything else is logged and shown generically. */
export class ServiceError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "ServiceError";
  }
}

export class NotFoundError extends ServiceError {
  constructor() {
    super("Request not found.", 404);
  }
}

export class StaleVersionError extends ServiceError {
  constructor(actedByName: string | null) {
    super(
      actedByName
        ? `This request was already actioned by ${actedByName}. The page has been refreshed with the latest status.`
        : "This request has changed since you opened it. The page has been refreshed with the latest status.",
      409,
    );
  }
}

export class NoBuAdminError extends ServiceError {
  constructor(businessUnit: string | null) {
    super(`Your business unit (${businessUnit ?? "unknown"}) has no BU Admin assigned. Please contact HR.`, 422);
  }
}

export class NoHodError extends ServiceError {
  constructor() {
    super("Your department has no HOD assigned. Please contact HR.", 422);
  }
}

export class NoDepartmentError extends ServiceError {
  constructor() {
    super("Please select your department before submitting.", 422);
  }
}

export class ValidationFailedError extends ServiceError {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super("Please complete the highlighted fields before submitting.", 422);
  }
}
