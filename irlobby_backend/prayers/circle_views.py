"""Church circles: create, directory, join requests, invites, and admin management.

Open join (POST .../join/) does not add a member. Ask to join, or accept an invite.
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from moderation.reporting import file_report

from .circle_policy import (
    MEMBER_PREVIEW_LIMIT,
    OPEN_JOIN_CODE,
    OPEN_JOIN_MESSAGE,
    accept_invite,
    annotated_circles,
    approve_join_request,
    circle_or_404,
    decline_invite,
    decline_join_request,
    inbox_invites,
    invite_payload,
    join_request_payload,
    leave_circle,
    make_admin,
    member_payload,
    member_rows,
    pending_invites_for_admin,
    pending_join_requests,
    remove_admin,
    remove_member,
    reported_user_for_circle,
    request_to_join,
    require_admin,
    search_people,
    send_invites,
)
from .notifications import notify_circle_invite, notify_join_decision, notify_join_request
from .serializers import CircleCreateSerializer, CircleSerializer
from .throttles import CircleCreateThrottle, CircleInviteThrottle


def _circle_data(user, circle_id, request):
    circle = annotated_circles(user).get(pk=circle_id)
    return CircleSerializer(circle, context={"request": request}).data


class CircleListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [CircleCreateThrottle]

    def get(self, request):
        circles = annotated_circles(request.user)
        query = " ".join((request.query_params.get("q") or "").split())[:80]
        if query:
            circles = circles.filter(name__icontains=query)
        payload = CircleSerializer(circles, many=True, context={"request": request}).data
        return Response({"church_id": request.user.church_id, "circles": payload})

    def post(self, request):
        serializer = CircleCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        circle = serializer.save()
        return Response(
            _circle_data(request.user, circle.pk, request), status=status.HTTP_201_CREATED
        )


class CircleDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        circle = annotated_circles(request.user).filter(pk=pk).first()
        if circle is None:
            raise NotFound()
        data = CircleSerializer(circle, context={"request": request}).data
        data["members_preview"] = [
            member_payload(row) for row in member_rows(circle, limit=MEMBER_PREVIEW_LIMIT)
        ]
        return Response(data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def join_circle(request, pk):
    """Kept so older clients get a clear error instead of a new membership."""
    circle_or_404(request.user, pk)
    return Response(
        {"detail": OPEN_JOIN_MESSAGE, "code": OPEN_JOIN_CODE},
        status=status.HTTP_400_BAD_REQUEST,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def leave_circle_view(request, pk):
    circle = circle_or_404(request.user, pk)
    leave_circle(request.user, circle)
    return Response(_circle_data(request.user, circle.pk, request))


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def circle_join_requests(request, pk):
    """GET lists pending requests (admin). POST asks to join (any person in the church)."""
    circle = circle_or_404(request.user, pk)
    if request.method == "GET":
        require_admin(request.user, circle)
        rows = pending_join_requests(circle, request.user)
        return Response({"requests": [join_request_payload(row) for row in rows]})
    row, created = request_to_join(request.user, circle)
    if created:
        notify_join_request(circle, request.user)
    code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return Response(join_request_payload(row), status=code)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def approve_circle_join_request(request, pk, request_id):
    circle = circle_or_404(request.user, pk)
    require_admin(request.user, circle)
    row = approve_join_request(request.user, circle, request_id)
    notify_join_decision(circle, row.user, approved=True)
    return Response(
        {
            "request": join_request_payload(row),
            "circle": _circle_data(request.user, circle.pk, request),
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def decline_circle_join_request(request, pk, request_id):
    circle = circle_or_404(request.user, pk)
    require_admin(request.user, circle)
    row = decline_join_request(request.user, circle, request_id)
    notify_join_decision(circle, row.user, approved=False)
    return Response({"request": join_request_payload(row)})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([CircleInviteThrottle])
def circle_invites(request, pk):
    """GET lists this circle's pending invites (admin). POST sends invites to user_ids."""
    circle = circle_or_404(request.user, pk)
    require_admin(request.user, circle)
    if request.method == "GET":
        rows = pending_invites_for_admin(circle)
        return Response({"invites": [invite_payload(row) for row in rows]})
    created, already, errors = send_invites(request.user, circle, request.data.get("user_ids"))
    for invite in created:
        notify_circle_invite(invite)
    invites = [invite_payload(row) for row in created + already]
    if not invites:
        return Response({"invites": [], "errors": errors}, status=status.HTTP_400_BAD_REQUEST)
    code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return Response({"invites": invites, "errors": errors}, status=code)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_circle_invites(request):
    rows = inbox_invites(request.user)
    return Response({"invites": [invite_payload(row, include_circle=True) for row in rows]})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def accept_circle_invite(request, invite_id):
    invite = accept_invite(request.user, invite_id)
    return Response(
        {
            "invite": {"id": invite.id, "status": invite.status},
            "circle": _circle_data(request.user, invite.circle_id, request),
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def decline_circle_invite(request, invite_id):
    invite = decline_invite(request.user, invite_id)
    return Response({"invite": {"id": invite.id, "status": invite.status}})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def circle_members(request, pk):
    circle = circle_or_404(request.user, pk)
    return Response({"members": [member_payload(row) for row in member_rows(circle)]})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def remove_circle_member(request, pk, user_id):
    circle = circle_or_404(request.user, pk)
    require_admin(request.user, circle)
    remove_member(circle, user_id)
    return Response(_circle_data(request.user, circle.pk, request))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def make_circle_admin(request, pk, user_id):
    circle = circle_or_404(request.user, pk)
    require_admin(request.user, circle)
    membership = make_admin(circle, user_id)
    return Response({"member": member_payload(membership)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def remove_circle_admin(request, pk, user_id):
    circle = circle_or_404(request.user, pk)
    require_admin(request.user, circle)
    membership = remove_admin(circle, user_id)
    return Response({"member": member_payload(membership)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def circle_people(request, pk):
    circle = circle_or_404(request.user, pk)
    require_admin(request.user, circle)
    people = search_people(circle, request.user, request.query_params.get("q") or "")
    return Response({"people": people})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def report_circle(request, pk):
    circle = circle_or_404(request.user, pk)
    return file_report(
        request,
        target_type="circle",
        target_id=circle.id,
        reported_user=reported_user_for_circle(circle, request.user),
        snapshot=f"{circle.name}: {circle.description}",
    )
