export type TransactionalEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export abstract class EmailDeliveryService {
  abstract send(email: TransactionalEmail): Promise<void>;
}

export class InMemoryEmailDeliveryService extends EmailDeliveryService {
  readonly sent: TransactionalEmail[] = [];

  async send(email: TransactionalEmail): Promise<void> {
    this.sent.push(email);
  }
}
