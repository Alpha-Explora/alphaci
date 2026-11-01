type K6Response = {
  status: number;
  timings: {
    duration: number;
  };
  body?: string;
};

type K6Checks = Record<string, (response: K6Response) => boolean>;

declare const __ENV: Record<string, string | undefined>;

declare module 'k6/http' {
  const http: {
    get: (url: string, params?: { tags?: Record<string, string> }) => K6Response;
    expectedStatuses: (...statuses: number[]) => (response: K6Response) => boolean;
    setResponseCallback: (callback: (response: K6Response) => boolean) => void;
  };

  export default http;
}

declare module 'k6' {
  export function check(response: K6Response, checks: K6Checks): boolean;
  export function sleep(seconds: number): void;
}
