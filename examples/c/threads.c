#include <pthread.h>
#include <stdio.h>

static const int num_increments = 2;

/* this function is run by the second thread */
void *thread_callback(void *arg)
{
    int *val = (int*)arg;
    while((*val) < num_increments){
        printf("incrementing\n");
        (*val)++;
    }
    printf("increment finished\n");
}

int main()
{
    int x = 0, y = 0;
    printf("x: %d, y: %d\n", x, y);
    pthread_t thread_to_increment_x, thread_to_increment_y;

    /* create and run threads */
    if(pthread_create(&thread_to_increment_x, NULL, thread_callback, &x)) {
        printf("error: pthread_create returned non-zero value\n");
        return 1;
    }
    if(pthread_create(&thread_to_increment_y, NULL, thread_callback, &y)) {
        printf("error: pthread_create returned non-zero value\n");
        return 1;
    }

    /* wait for threads to finish */
    if(pthread_join(thread_to_increment_x, NULL)) {
        printf("error: pthread_join returned non-zero value\n");
        return 1;
    }
    if(pthread_join(thread_to_increment_y, NULL)) {
        printf("error: pthread_join returned non-zero value\n");
        return 1;
    }
    printf("x: %d, y: %d\n", x, y);

    return 0;

}
