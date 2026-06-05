import type {
  SubscriptionCheckoutResponse,
  SubscriptionCheckoutStatusResponse,
  SubscriptionInfo,
} from "./contracts";
import { request } from "./request";

export async function createSubscriptionCheckout(
  plan: "pro",
): Promise<SubscriptionCheckoutResponse> {
  return request<SubscriptionCheckoutResponse>("/subscription/checkout", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}

export async function getCheckoutStatus(
  checkoutId: string,
): Promise<SubscriptionCheckoutStatusResponse> {
  return request<SubscriptionCheckoutStatusResponse>(
    `/subscription/checkout/${encodeURIComponent(checkoutId)}/status`,
  );
}

export async function activateMonthlySubscription(plan: "pro"): Promise<SubscriptionInfo> {
  const response = await request<{ subscription: SubscriptionInfo }>("/subscription/monthly/activate", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });

  return response.subscription;
}

export async function cancelMonthlySubscription(): Promise<SubscriptionInfo> {
  const response = await request<{ subscription: SubscriptionInfo }>("/subscription/monthly/cancel", {
    method: "POST",
  });

  return response.subscription;
}
