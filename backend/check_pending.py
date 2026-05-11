from app import create_app
from models import PendingUser

app = create_app()
with app.app_context():
    print(f"{'ID':<30} | {'Name':<20} | {'Email':<30}")
    print("-" * 85)
    pending = PendingUser.objects.all()
    for p in pending:
        print(f"{str(p.id):<30} | {p.name:<20} | {p.email:<30}")
    print("-" * 85)
    print(f"Total pending users: {len(pending)}")
