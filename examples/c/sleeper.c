#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <math.h>

double test_function(int x) {
    if (x < 10) {
        return 10 * sin(x * 0.8);
    }

    if (x < 20) {
        const double t = (x - 10) / 10;
        const double amplitude = 10 + t * 40;

        return amplitude * sin(x * 0.65) + 2;
    }

    if (x < 30) {
        double y =
            45 * sin(x * 0.55) +
            5 * cos(x * 0.2) +
            sin(x * 17.123) * 8;

        if (x == 22) y += 35;
        if (x == 25) y -= 45;
        if (x == 28) y += 30;

        return fmax(-100, fmin(100, y));
    }

    const double t = x - 30;
    const double baseline = 200 + t * 8;

    double y =
        baseline +
        45 * sin(x * 0.45) +
        12 * cos(x * 0.9);

    //random spikes
    if (x == 34) y += 60;
    if (x == 39) y -= 80;
    if (x == 45) y += 70;
    if (x == 52) y -= 60;
    if (x == 58) y += 50;

    return y;
}


int main(int argc, char **argv) {
  printf("entering\n");
  int x = 0;
  int y;
  while(1){
    // while this loop is running, you cannot interact with
    // gdb until you interrupt (send signal SIGINT) to gdb
    // or the inferior process
    y = test_function(x++);
    printf("sleeping...\n");
    usleep(100);
    printf("Finished sleeping. Repeating.\n");
  }
  printf("exiting\n");
  return 0;
}
