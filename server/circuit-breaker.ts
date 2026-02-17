type CircuitState = "closed" | "open" | "half-open";

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  requestTimeoutMs: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
  requestTimeoutMs: 30_000,
};

class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private lastFailureTime = 0;
  private options: CircuitBreakerOptions;
  private name: string;

  constructor(name: string, options?: Partial<CircuitBreakerOptions>) {
    this.name = name;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs) {
        this.state = "half-open";
      } else {
        throw new Error(`Circuit breaker '${this.name}' is open — service temporarily unavailable`);
      }
    }

    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`${this.name} request timed out after ${this.options.requestTimeoutMs}ms`)), this.options.requestTimeoutMs)
        ),
      ]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = "closed";
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = "open";
      console.warn(`[CircuitBreaker] '${this.name}' opened after ${this.failureCount} failures. Will retry in ${this.options.resetTimeoutMs / 1000}s`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

export const openaiBreaker = new CircuitBreaker("OpenAI", {
  failureThreshold: 3,
  resetTimeoutMs: 60_000,
  requestTimeoutMs: 45_000,
});

export const overpassBreaker = new CircuitBreaker("Overpass", {
  failureThreshold: 3,
  resetTimeoutMs: 120_000,
  requestTimeoutMs: 15_000,
});

export const resendBreaker = new CircuitBreaker("Resend", {
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
  requestTimeoutMs: 10_000,
});
