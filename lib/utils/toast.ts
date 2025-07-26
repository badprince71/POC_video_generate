import toast from 'react-hot-toast'

// Toast utility functions for consistent messaging across the app
export const showToast = {
  // Success messages
  success: (message: string) => {
    toast.success(message, {
      duration: 3000,
      position: 'top-right',
    })
  },

  // Error messages
  error: (message: string) => {
    toast.error(message, {
      duration: 5000,
      position: 'top-right',
    })
  },

  // Info messages
  info: (message: string) => {
    toast(message, {
      duration: 4000,
      position: 'top-right',
      style: {
        background: '#3b82f6',
        color: '#fff',
      },
    })
  },

  // Warning messages
  warning: (message: string) => {
    toast(message, {
      duration: 4000,
      position: 'top-right',
      style: {
        background: '#f59e0b',
        color: '#fff',
      },
    })
  },

  // Loading messages
  loading: (message: string) => {
    return toast.loading(message, {
      position: 'top-right',
    })
  },

  // Dismiss a specific toast
  dismiss: (toastId: string) => {
    toast.dismiss(toastId)
  },

  // Dismiss all toasts
  dismissAll: () => {
    toast.dismiss()
  }
}

// Specific toast messages for common actions
export const toastMessages = {
  // Story generation
  storyGenerated: 'Story generated successfully!',
  storyFailed: 'Failed to generate story. Please try again.',
  
  // Frame generation
  framesGenerated: (count: number) => `Successfully generated ${count} frames!`,
  framesFailed: 'Error generating frames. Please try again.',
  framesSaved: 'Frames saved successfully!',
  framesSaveFailed: 'Failed to save frames to database.',
  
  // Video generation
  videoGenerationStarted: 'Starting video clip generation...',
  videoClipsGenerated: 'Video clips generated successfully!',
  videoMergeStarted: 'Starting video merging...',
  videoMergeCompleted: 'Video clips merged successfully!',
  videoMergeFailed: 'Error merging video clips. Please try again.',
  noClipsToMerge: 'No completed video clips to merge',
  
  // File operations
  imagesSaved: (count: number) => `Successfully saved ${count} images!`,
  imagesSaveFailed: 'Failed to save images. Please try again.',
  
  // General
  operationFailed: 'Operation failed. Please try again.',
  networkError: 'Network error. Please check your connection.',
  unknownError: 'An unknown error occurred. Please try again.'
}

// Helper function to show error with fallback
export const showError = (error: unknown, fallbackMessage: string = 'An error occurred') => {
  const message = error instanceof Error ? error.message : fallbackMessage
  showToast.error(message)
}

// Helper function to show success with optional count
export const showSuccess = (message: string, count?: number) => {
  const finalMessage = count !== undefined ? message.replace('{count}', count.toString()) : message
  showToast.success(finalMessage)
} 