// Background worker for processing slicing tasks
// This runs independently of the main app and continues even if the tab is closed

const WORKER_INTERVAL = 10000; // Check for tasks every 10 seconds
const SUPABASE_URL = 'https://ecmrkjwsjkthurwljhvp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjbXJrandzamt0aHVyd2xqaHZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwNjM1MDksImV4cCI6MjA1MTYzOTUwOX0.e_1z7aG9L4R1EGWA0gJGxwkPYTNLfVWJ1cVK4sqyXbg';

console.log('[BackgroundWorker] Service worker loaded');

let workerInterval = null;

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
  console.log('[BackgroundWorker] Received message:', event.data);

  if (event.data.type === 'START_WORKER') {
    startWorker();
  } else if (event.data.type === 'STOP_WORKER') {
    stopWorker();
  } else if (event.data.type === 'PROCESS_TASK') {
    await processTask(event.data.taskId);
  }
});

function startWorker() {
  if (workerInterval) {
    console.log('[BackgroundWorker] Worker already running');
    return;
  }

  console.log('[BackgroundWorker] Starting worker...');
  workerInterval = setInterval(checkAndProcessTasks, WORKER_INTERVAL);

  // Run immediately
  checkAndProcessTasks();
}

function stopWorker() {
  if (workerInterval) {
    console.log('[BackgroundWorker] Stopping worker...');
    clearInterval(workerInterval);
    workerInterval = null;
  }
}

async function checkAndProcessTasks() {
  try {
    console.log('[BackgroundWorker] Checking for pending tasks...');

    // Get auth token from storage
    const authData = await getAuthToken();
    if (!authData) {
      console.log('[BackgroundWorker] No auth token, skipping');
      return;
    }

    // Get pending tasks
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_pending_tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${authData.access_token}`,
      },
      body: JSON.stringify({ p_limit: 5 }),
    });

    if (!response.ok) {
      console.error('[BackgroundWorker] Failed to get tasks:', response.status);
      return;
    }

    const tasks = await response.json();
    console.log('[BackgroundWorker] Found tasks:', tasks.length);

    // Process each task
    for (const task of tasks) {
      try {
        await processTask(task.id, authData.access_token);
      } catch (error) {
        console.error('[BackgroundWorker] Task processing failed:', task.id, error);
      }
    }
  } catch (error) {
    console.error('[BackgroundWorker] Error checking tasks:', error);
  }
}

async function processTask(taskId, accessToken) {
  console.log('[BackgroundWorker] Processing task:', taskId);

  try {
    // Get auth token if not provided
    if (!accessToken) {
      const authData = await getAuthToken();
      if (!authData) {
        throw new Error('No auth token available');
      }
      accessToken = authData.access_token;
    }

    // Import and call the processing function
    // Note: In a real service worker, you'd need to handle this differently
    // For now, we'll just update the status and notify the main thread
    self.postMessage({
      type: 'TASK_STARTED',
      taskId: taskId,
    });

    // The actual processing will be done by the main thread or a server-side function
    // This worker just coordinates and keeps track
    console.log('[BackgroundWorker] Task processing delegated:', taskId);
  } catch (error) {
    console.error('[BackgroundWorker] Failed to process task:', taskId, error);
    self.postMessage({
      type: 'TASK_FAILED',
      taskId: taskId,
      error: error.message,
    });
  }
}

async function getAuthToken() {
  try {
    // Try to get auth from IndexedDB or localStorage
    // This is a simplified version - in production, you'd use proper storage
    const keys = await caches.keys();
    for (const key of keys) {
      if (key.includes('supabase')) {
        const cache = await caches.open(key);
        const requests = await cache.keys();
        for (const request of requests) {
          const response = await cache.match(request);
          if (response) {
            const data = await response.json();
            if (data.access_token) {
              return data;
            }
          }
        }
      }
    }
    return null;
  } catch (error) {
    console.error('[BackgroundWorker] Failed to get auth token:', error);
    return null;
  }
}

console.log('[BackgroundWorker] Worker script initialized');
