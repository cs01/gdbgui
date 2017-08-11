#include <stdlib.h>
#include <stdio.h>
#include <string.h>

struct Node
{
    struct Node* left;
    struct Node* right;
    char* name;
};

void visit(struct Node* node)
{
    printf("visiting node '%s'\n", node->name);
}

void dfs(struct Node *node)
{
    if (node == NULL)
    {
        return;
    }

    visit(node);
    dfs(node->left);
    dfs(node->right);
}

int main(void)
{
    printf("gdbgui has a widget that allows interactive tree exploration. "
        "Enter 'root' in  'Expressions' widget, then hover over root and click the tree icon next to 'root' to draw the tree. "
        "The tree is automatically updated as the program's state changes changed.\n\n");
    /* initialize nodes so that left/right are NULL and each
    node has a name */
    struct Node
        root = {.name = "root"},
        a = {.name = "a"},
        b = {.name = "b"},
        c = {.name = "c"},
        d = {.name = "d"},
        e = {.name = "e"},
        f = {.name = "f"};

    /* connect nodes */
    printf("As you step through the following code, you can see the graph grow and change as assignments are made\n");
    root.left = &a;
    root.right = &b;
    a.left = &c;
    a.right = &d;
    d.left = &e;
    b.right = &f;

    printf("beginning depth first search. We can verify the dfs algorithm is accurate by comparing it to gdbgui's graph view.\n");
    dfs(&root);
    printf("finished depth first search\n");
    return 0;
}
