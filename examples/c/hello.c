#include <stdio.h>
#include <string.h>
void say_something(const char *str)
{
  printf("%s\n", str);
}

struct mystruct_t
{
  int value;
  char letter;
  char *string;

  struct
  {
    double dbl;
  } substruct; /* named sub-struct */

  struct
  {
    float fp;
  }; /* anonymous struct */

  void *ptr;
  size_t struct_size;
  union {
    int unionint;
    double uniondouble;
  };
};

int main(int argc, char **argv)
{
  printf("Hello World\n");

  int retval = 1;

  /* bytes are allocated for s,
  but still contain garbage */
  struct mystruct_t s;
  s.value = 100;
  s.string = "pass";
  s.substruct.dbl = 567.8;
  s.letter = 'P';
  s.fp = 123.4;
  s.ptr = say_something;  /* address of function */
  s.ptr = &say_something; /* also address of function */
  s.unionint = 0;
  s.uniondouble = 1.0;

  for (int i = 0; i < 2; i++)
  {
    printf("i is %d\n", i);
  }

  if (!strcmp(s.string, "pass"))
  {
    retval = 0;
  }

  printf("returning %d\n", retval);
  say_something("Goodbye");
  return retval;
}
