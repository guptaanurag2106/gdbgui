#include <pthread.h>
#include <stdio.h>

void work(int x) {
    x += 2;
    x += 1;
    printf("work(%d)\n", x);
}

void *thread_func(void *arg) {
    printf("Child thread start\n");
    work(10);
    printf("Child thread end\n");
    return NULL;
}

int main() {
    pthread_t t;

    printf("Main thread start\n");

    pthread_create(&t, NULL, thread_func, NULL);

    work(11);

    pthread_join(t, NULL);

    printf("Main thread end\n");
    return 0;
}
