# Mermaid Rendering Test

## Test 1 - Simple graph
```mermaid
graph LR
    A[Start] --> B[End]
```

## Test 2 - Subgraph
```mermaid
graph TB
    subgraph SG1["Group One"]
        X[Node X]
        Y[Node Y]
    end
    X --> Y
```

## Test 3 - Sequence diagram (clean)
```mermaid
sequenceDiagram
    participant A as Client
    participant B as Server
    A->>B: send request
    B-->>A: return response
```

## Test 4 - Styled nodes
```mermaid
graph LR
    A[Node A] --> B[Node B]
    style A fill:#E8F5E9,stroke:#2E7D32
    style B fill:#FFF3E0,stroke:#E65100
```

## Test 5 - ER diagram
```mermaid
erDiagram
    USERS {
        string id PK
        string name
    }
    ORDERS {
        string id PK
        string user_id FK
    }
    USERS ||--o{ ORDERS : has
```

## Test 6 - Decision diamond
```mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Path A]
    B -->|No| D[Path B]
```

## Test 7 - Labels with br
```mermaid
graph LR
    A["Multi line<br/>node label"] --> B["Another<br/>multi line"]
```

## Test 8 - Edge labels
```mermaid
graph LR
    A --> |label one| B
    B --> |label two| C
```
