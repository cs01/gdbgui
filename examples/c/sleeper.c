#include <stdio.h>
#include <string.h>
#include <unistd.h>

int main(int argc, char **argv) {
  printf("entering\n");
  while(1){
    // while this loop is running, you cannot interact with
    // gdb until you interrupt (send signal SIGINT) to gdb
    // or the inferior process
    printf("sleeping...\n");
    sleep(2);
    printf("Finished sleeping. Repeating.\n");
  }
  printf("exiting\n");
  return 0;
}
