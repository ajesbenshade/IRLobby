import axios from 'axios';

export const getErrorMessage = (error: unknown, fallback = 'Something went wrong. Please try again.') => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    if (typeof responseData === 'string') {
      return responseData;
    }
    if (responseData && typeof responseData === 'object') {
      if (typeof (responseData as { detail?: string }).detail === 'string') {
        return (responseData as { detail?: string }).detail as string;
      }
      const firstEntry = Object.values(responseData)[0];
      if (Array.isArray(firstEntry) && typeof firstEntry[0] === 'string') {
        return firstEntry[0];
      }
    }
    if (typeof error.message === 'string') {
      return error.message;
    }
  } else if (error instanceof Error) {
    return error.message;
  }
  return fallback;
};
