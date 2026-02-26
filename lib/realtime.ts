type Subscriber = (payload: string) => void;

const subscribers = new Set<Subscriber>();

export function subscribe(subscriber: Subscriber) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  subscribers.forEach((subscriber) => subscriber(payload));
}
