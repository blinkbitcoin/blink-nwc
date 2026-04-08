import { Nip47Notification } from "@/domain/nostr/index.types"
import { UserId } from "@/domain/index.types"

interface QueuedNotification {
  notification: Nip47Notification
  userId: UserId
  addedAt: number
  retries: number
}

export const NotificationQueue = () => {
  const queue: QueuedNotification[] = []

  const enqueue = (notification: Nip47Notification, userId: UserId) => {
    queue.push({
      notification,
      userId,
      addedAt: Date.now(),
      retries: 0,
    })
    //todo log pushing notification to queue
  }

  const dequeueAll = (): QueuedNotification[] => {
    const batch = [...queue]
    queue.length = 0
    return batch
  }

  const requeue = (item: QueuedNotification, maxRetries = 3) => {
    if (item.retries < maxRetries) {
      item.retries++
      queue.push(item)
      // todo log Re-queueing notifications
    } else {
      //todo log dropping notifications
    }
  }

  const size = () => queue.length

  return { enqueue, dequeueAll, requeue, size }
}
