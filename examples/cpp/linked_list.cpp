#include <iostream>

class Node{

private:
    Node* next = 0;
    Node* prev = 0;
    int value;

public:
    Node(int v){
        value = v;
    }

    int get_value() const{
        return value;
    }

    void print_values() const{
        std::cout << this->get_value() << std::endl;
        if(this->next){
            this->next->print_values();
        }
    }

    void append(int v){
        Node* new_node = new Node(v);
        Node* iter = this;
        while(iter->next){
            iter = iter->next;
        }
        iter->next = new_node;
        new_node->prev = iter;
    }
};

int main(){
    Node* linked_list = new Node(0);
    linked_list->print_values();
    linked_list->append(1);
    linked_list->append(2);
    linked_list->append(3);
    linked_list->append(4);
    linked_list->print_values();
    return 0;
}
