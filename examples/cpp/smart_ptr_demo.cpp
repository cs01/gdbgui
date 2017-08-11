// A demonstration of unique, smart, weak, and raw pointers in C++11.
// compile with:
//  g++ smart_ptr_demo.cpp -std=c++11 -o smart_ptr_cpp_demo.a -g
//
// running yields:
// >> ./smart_ptr_demo_cpp.a
// constructed raw pointer, at address 0x169fc20
// entering local scope
// entered local scope
// constructed unique (only one reference) pointer, at address 0x16a0090
// constructed shared (local and global reference) pointer, at address 0x16a00f0
// constructed shared (one shared reference, two weak references) pointer, at address 0x16a0060
// local weak pointer has valid reference
// global weak pointer has valid reference
// smart pointers can be accessed like regular pointers
// This is my type: unique (only one reference)
// This is my type: shared (local and global reference)
// leaving local scope
// destroyed shared (one shared reference, two weak references) pointer, at address 0x16a0060
// destroyed unique (only one reference) pointer, at address 0x16a0090
// left local scope
// global weak pointer has no reference
// destroyed raw pointer, at address 0x169fc20
// leaving main
// destroyed shared (local and global reference) pointer, at address 0x16a00f0


#include <iostream>
#include <memory>
#include <string>

// A class that prints metadata when constructed and destroyed
class SimpleType
{
    std::string m_ptr_type;

public:
    SimpleType(const std::string& ptr_type){
        m_ptr_type = ptr_type;
        std::cout << "constructed " << m_ptr_type << " pointer, at address " << this << std::endl;
    }
    ~SimpleType(){
        std::cout << "destroyed " << m_ptr_type << " pointer, at address " << this << std::endl;
    }
    void identify(){
        std::cout << "This is my type: " << m_ptr_type << std::endl;
    }
};

int main()
{
    std::unique_ptr<SimpleType> globalunique;
    std::shared_ptr<SimpleType> globalshared;
    std::weak_ptr<SimpleType> globalweak;
    SimpleType* raw_ptr = new SimpleType("raw");

    // locally scoped operations will cause smart pointers to automatically
    // be deleted (garbage collected) if no owners remain at the end of the scope
    std::cout << "entering local scope" << std::endl;
    {
        std::cout << "entered local scope" << std::endl;
        // unique (deleted upon exit of this local scope)
        std::unique_ptr<SimpleType> localunique = std::unique_ptr<SimpleType>(new SimpleType("unique (only one reference)"));

        // shared with > 1 owner (not deleted upon exit of this local scope)
        std::shared_ptr<SimpleType> localshared = std::shared_ptr<SimpleType>(new SimpleType("shared (local and global reference)"));
        globalshared = localshared;  // assign global reference

        // shared with exactly 1 owner (deleted upon exit of this local scope)
        std::shared_ptr<SimpleType> localshared2 = std::shared_ptr<SimpleType>(new SimpleType("shared (one shared reference, two weak references)"));
        std::weak_ptr<SimpleType> localweak = localshared2;  // shared_ptr reference count does not increment here, because weak pointers don't "own" the pointer
        globalweak = localweak;  // again, the shared_ptr reference count does not increment
        // prove that the weak pointer references the shared pointer (but it does not own it!)
        std::cout << (localweak.lock() ? "local weak pointer has valid reference" : "local weak pointer has no reference") << std::endl;
        std::cout << (globalweak.lock() ? "global weak pointer has valid reference" : "global weak pointer has no reference") << std::endl;

        std::cout << "smart pointers can be accessed like regular pointers" << std::endl;
        localunique->identify();
        (*globalshared).identify();

        std::cout << "leaving local scope" << std::endl;
    } // localshared is not deleted here because the globalshared reference still exists and shares ownership of it.
      // localshared2/globalweak's object is deleted here. Even though globalweak still references it, it doesn't own it, so it's deleted.

    std::cout << "left local scope" << std::endl;
    std::cout << (globalweak.lock() ? "global weak pointer has valid reference" : "global weak pointer has no reference") << std::endl;
    delete raw_ptr;  // this needs to be done manually

    std::cout << "leaving main" << std::endl;
}
