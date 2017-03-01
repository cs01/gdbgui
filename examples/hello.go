package main
import "fmt"

func main() {
    fmt.Println("hello world")
    // Create an array of three ints.
    array := [...]int{10, 20, 30}

    // Loop over three ints and print them.
    for i := 0; i < len(array); i++ {
        fmt.Println(array[i])
    }
}
