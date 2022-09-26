/**
 * Pause execution for amount of seconds.
 *
 * @param seconds
 *   Number of seconds to wait.
 */
export const sleep = (seconds: number): Promise<void> => {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, seconds * 1000);
  });
};
