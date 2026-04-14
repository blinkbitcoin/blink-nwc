import { NotificationQueue } from "@/domain/notifications/queue"

describe("NotificationQueue", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("enqueues notifications with metadata and clears them on dequeue", () => {
    jest.spyOn(Date, "now").mockReturnValue(1710000000000)
    const queue = NotificationQueue()
    const notification = {
      notification_type: "payment_received",
      notification: {
        type: "incoming",
        payment_hash: "hash",
        amount: 1000,
        fees_paid: 0,
        created_at: 1710000000,
      },
    } as never

    queue.enqueue(notification, "user-1" as never)

    expect(queue.size()).toBe(1)
    expect(queue.dequeueAll()).toEqual([
      {
        notification,
        userId: "user-1",
        addedAt: 1710000000000,
        retries: 0,
      },
    ])
    expect(queue.size()).toBe(0)
  })

  it("requeues items until the retry limit is reached", () => {
    const queue = NotificationQueue()
    const item = {
      notification: {} as never,
      userId: "user-1" as never,
      addedAt: 1,
      retries: 0,
    }

    queue.requeue(item, 2)
    queue.requeue(item, 2)
    queue.requeue(item, 2)

    expect(queue.dequeueAll()).toEqual([
      expect.objectContaining({ retries: 2 }),
      expect.objectContaining({ retries: 2 }),
    ])
  })
})
