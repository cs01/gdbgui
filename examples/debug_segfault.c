#include <stdlib.h>
#include <stdio.h>
#include <string.h>

int main(void)
{
    char* badstring = 0;
    const char* s = "gdbgui";

    int myvar = 100;
    unsigned int myvar2 = 200;

    printf("The next function call will cause a segfault. With gdbgui, the state of the program\n"
        "can be debugged at the time the program exited by running the command\n"
        "\"backtrace\" or \"bt\" in the gdb console.\n\n"
        "It will re-enter the state the\n"
        "program was in, including the stack trace: you'll end up in `main -> _IO_puts -> strlen`.\n"
        "If you click on the `main` function in the call stack, gdbgui will put you in the main function\n"
        "where you can inspect your local\n"
        "variables and determine how the segfault occured.\n\n"
        );


    printf("%s\n", badstring);

    printf("This line is never reached because the above line causes a segfault\n");
    return 0;
}
