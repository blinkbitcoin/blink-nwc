type GrpcData = import("google-protobuf").Message
type GrpcMetadata = import("@grpc/grpc-js").Metadata
type GrpcServiceError = import("@grpc/grpc-js").ServiceError
type ClientReadableStream<T extends GrpcData> =
  import("@grpc/grpc-js").ClientReadableStream<T>
type Stream<
  T extends GrpcData,
  R extends GrpcData = GrpcData,
> = import("./stream").Stream<T, R>

type StreamEvents =
  (typeof import("./stream").StreamEvents)[keyof typeof import("./stream").StreamEvents]
type StreamMethod<T extends GrpcData> = <A extends Array<unknown>>(
  ...args: A
) => ClientReadableStream<T>

type GrpcStreamRetryEventDetails = {
  readonly retries: number
  readonly backoff: number
}

type Listener<T extends GrpcData, R extends GrpcData, K extends keyof StreamEventMap> = (
  instance: Stream<T, R>,
  ev: StreamEventMap[K],
) => unknown

type GrpcStreamEventsListener<
  T extends GrpcData,
  R extends GrpcData,
  K extends keyof StreamEventMap,
> = {
  readonly listener: Listener<T, R, K>
  readonly options?: boolean | EventListenerOptions
}

type StreamEventMapA<T extends GrpcData, R extends GrpcData = GrpcData> = {
  metadata: GrpcStreamEventsListener<T, R, "metadata">[]
  data: GrpcStreamEventsListener<T, R, "data">[]
  end: GrpcStreamEventsListener<T, R, "end">[]
  error: GrpcStreamEventsListener<T, R, "error">[]
  retry: GrpcStreamEventsListener<T, R, "retry">[]
}

type StreamEventMap = {
  metadata: GrpcMetadata
  data: GrpcData
  end: unknown
  error: GrpcServiceError
  retry: CustomEvent<GrpcStreamRetryEventDetails>
}

type StreamOptions = {
  retry?: boolean
  acceptDataOnReconnect?: boolean
  retries?: number
  isObject?: boolean
}

interface BaseBackOff {
  next(): number
  reset(): void
}
