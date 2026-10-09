package com.urbanex.callsync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SyncWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            if (Sync.run(applicationContext)) Result.success() else Result.retry()
        } catch (e: Exception) {
            Prefs.setStatus(applicationContext, "Something went wrong (${e.javaClass.simpleName}). Will try again.")
            Result.retry()
        }
    }
}
