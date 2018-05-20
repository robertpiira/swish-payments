import fetch from "node-fetch"
import https, { AgentOptions } from "https"

import { Request, Response, RequestHandler } from "express"

export interface PaymentBase {
  amount: string
  currency: string
  callbackUrl: string
  payerAlias?: string
  payeeAlias: string
  message: string
}

export interface PaymentRequest extends PaymentBase {
  payeePaymentReference?: string
}

export interface PaymentResponse extends PaymentBase {
  id: string
  paymentReference: string
  status: string
  dateCreated: string
  datePaid?: string
  errorCode?: string
  errorMessage?: string
  additionalInformation?: string
}

export interface RefundRequest {
  payerPaymentReference?: string
  originalPaymentReference: string
  paymentReference?: string
  callbackUrl: string
  payerAlias?: string
}

export default class SwishPayments {
  constructor(private opts: { endpoint: string; serverIP: string; cert: AgentOptions }) {}
  /**
   * Get payment from payment request token
   *
   * @param  {string} token
   * @returns PaymentResponseType
   */
  getPayment(token: string): Promise<PaymentResponse> {
    return fetch(`${this.opts.endpoint}/paymentrequests/${token}`, {
      agent: new https.Agent(this.opts.cert)
    })
      .then(res => res.json())
      .catch(handleError)
  }
  /**
   * Request a payment and return a token. This token is used to launch Swish from the client
   *
   * @param  {PaymentRequestType} data
   * @returns Promise
   */
  paymentRequest(data: PaymentRequest): Promise<string> {
    return fetch(`${this.opts.endpoint}/paymentrequests`, {
      agent: new https.Agent(this.opts.cert),
      method: "POST",
      body: JSON.stringify({ ...data, currency: "SEK" }),
      headers: { "Content-Type": "application/json" }
    })
      .then(handleToken)
      .catch(handleError)
  }
  /**
   * Request a refund
   *
   * @param  {RefundRequestType} data
   * @returns Promise
   */
  refundRequest(data: RefundRequest): Promise<any | Error> {
    return fetch(`${this.opts.endpoint}/paymentrequests`, {
      agent: new https.Agent(this.opts.cert),
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" }
    }).catch(handleError)
  }
  /**
   * Create a function Swish will call as callbackUrl on payment and refund requests
   *
   * @param  {Function} callback
   */
  createHook(callback: Function): RequestHandler {
    return (req: Request, res: Response) => {
      const ip = (req.connection && req.connection.remoteAddress) || ""

      if (!ip.includes(this.opts.serverIP)) {
        return res.status(401).send("not authorized")
      }

      callback(req.body)
      return res.status(201)
    }
  }
}

async function handleToken(res: any) {
  if (res.status !== 201) {
    throw await res.json()
  } else {
    return {
      swishId: res.headers.get("location").split("paymentrequests/")[1],
      paymentRequestToken: res.headers.paymentrequesttoken
    }
  }
}

function handleError(err: Error) {
  throw err
}
