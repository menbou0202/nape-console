// Transport pipeline adapted from zmk-studio-ts-client (MIT).
// Stock messages keep their original codecs; only subsystem 20 is extended.
import type { RpcConnection, CreateRpcConnectionOpts, Request, RequestResponse, Notification } from "@zmkfirmware/zmk-studio-ts-client";
import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";
import { get_encoder, get_decoder } from "@zmkfirmware/zmk-studio-ts-client/framing";
import { encodeNapeRequest, decodeNapeResponse } from "./napeCodec";

export function create_rpc_connection(transport: RpcTransport, opts?: CreateRpcConnectionOpts): RpcConnection {
  const requests = new TransformStream<Request, Uint8Array>({
    transform(request, controller) { controller.enqueue(encodeNapeRequest(request)); },
  });
  requests.readable.pipeThrough(new TransformStream(get_encoder()), opts)
    .pipeTo(transport.writable, opts).catch((error) => transport.abortController.abort(error));

  const responses = transport.readable.pipeThrough(new TransformStream(get_decoder()), opts)
    .pipeThrough(new TransformStream<Uint8Array, ReturnType<typeof decodeNapeResponse>>({
      transform(bytes, controller) { controller.enqueue(decodeNapeResponse(bytes)); },
    }), opts);
  const [replies, notifications] = responses.tee();
  return {
    label: transport.label,
    current_request: 0,
    request_writable: requests.writable,
    request_response_readable: replies.pipeThrough(new TransformStream<ReturnType<typeof decodeNapeResponse>, RequestResponse>({
      transform(response, controller) { if (response.requestResponse) controller.enqueue(response.requestResponse); },
    }), opts),
    notification_readable: notifications.pipeThrough(new TransformStream<ReturnType<typeof decodeNapeResponse>, Notification>({
      transform(response, controller) { if (response.notification) controller.enqueue(response.notification); },
    }), opts),
  };
}
